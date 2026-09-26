-- ═══════════════════════════════════════════════════════════════════════════
-- OptiFleet v2 — 05: logica de business (RPC)
--
-- Fiecare funcție: SECURITY DEFINER, search_path fix, verifică explicit cine
-- apelează, validează intrarea, scrie jurnalul. Erorile au mesaje în română
-- pentru a fi afișate direct utilizatorului.
-- ═══════════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- ═══ Flotă ═════════════════════════════════════════════════════════════════

-- K7: salvează planul de încărcare (vedere de sus). Validează pe server exact
-- ce validează și editorul: limite, cuplaj tren rutier, suprapuneri, sarcină.
create function public.save_vehicle_layout(p_vehicle uuid, p_items jsonb) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v public.vehicles;
  v_count int;
  v_own_pallets int;
  v_own_kg int;
  v_bad text;
begin
  select * into v from public.vehicles where id = p_vehicle for update;
  if not found or v.company_id is distinct from public.current_company_id() then
    raise exception 'Vehicul inexistent sau fără drept de modificare.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Format invalid pentru planul de încărcare.' using errcode = '22023';
  end if;
  v_count := jsonb_array_length(p_items);
  if v_count > 80 then
    raise exception 'Maxim 80 de paleți într-un plan.' using errcode = '22023';
  end if;

  drop table if exists _layout;
  create temporary table _layout on commit drop as
  select t.ord::int as idx, t.x_cm, t.y_cm, t.length_cm, t.width_cm, t.format, t.weight_kg, t.booking_id, t.label
  from rows from (jsonb_to_recordset(p_items)
         as (x_cm int, y_cm int, length_cm int, width_cm int, format text, weight_kg int, booking_id uuid, label text))
       with ordinality as t(x_cm, y_cm, length_cm, width_cm, format, weight_kg, booking_id, label, ord);

  if exists (select 1 from _layout where x_cm is null or y_cm is null or length_cm is null or width_cm is null
             or weight_kg is null or format not in ('EUR', 'INDUSTRIAL', 'CUSTOM')) then
    raise exception 'Fiecare palet are nevoie de poziție, dimensiuni, format și greutate.' using errcode = '22023';
  end if;

  select format('Paletul #%s iese din caroserie (%s×%s cm).', idx, v.cargo_length_cm, v.cargo_width_cm) into v_bad
  from _layout
  where x_cm < 0 or y_cm < 0 or x_cm + length_cm > v.cargo_length_cm or y_cm + width_cm > v.cargo_width_cm
  limit 1;
  if v_bad is not null then raise exception '%', v_bad using errcode = '22023'; end if;

  if v.body_type = 'ROAD_TRAIN' then
    select format('Paletul #%s trece peste cuplajul dintre camion și remorcă.', idx) into v_bad
    from _layout where x_cm < v.cargo_length_cm / 2 and x_cm + length_cm > v.cargo_length_cm / 2 limit 1;
    if v_bad is not null then raise exception '%', v_bad using errcode = '22023'; end if;
  end if;

  select format('Paleții #%s și #%s se suprapun.', a.idx, b.idx) into v_bad
  from _layout a join _layout b on a.idx < b.idx
  where a.x_cm < b.x_cm + b.length_cm and b.x_cm < a.x_cm + a.length_cm
    and a.y_cm < b.y_cm + b.width_cm  and b.y_cm < a.y_cm + a.width_cm
  limit 1;
  if v_bad is not null then raise exception '%', v_bad using errcode = '22023'; end if;

  -- Paleții marcați „rezervați” trebuie să aparțină unui contract activ al acestui vehicul
  select format('Rezervarea %s nu e un contract activ al acestui vehicul sau are prea mulți paleți plasați.', l.booking_id)
    into v_bad
  from _layout l
  left join public.bookings b on b.id = l.booking_id and b.vehicle_id = v.id and b.status in ('CONTRACTED', 'IN_TRANSIT')
  where l.booking_id is not null
  group by l.booking_id, b.id, b.pallets
  having b.id is null or count(*) > b.pallets
  limit 1;
  if v_bad is not null then raise exception '%', v_bad using errcode = '22023'; end if;

  select count(*)::int, coalesce(sum(weight_kg), 0)::int into v_own_pallets, v_own_kg
  from _layout where booking_id is null;

  if v_own_pallets + v.booked_pallets > v.pallet_capacity then
    raise exception 'Capacitate depășită: % paleți proprii + % rezervați > % locuri.',
      v_own_pallets, v.booked_pallets, v.pallet_capacity using errcode = '22023';
  end if;
  if v_own_kg + v.booked_weight_kg > v.max_payload_kg then
    raise exception 'Sarcină depășită: % kg > % kg admiși.', v_own_kg + v.booked_weight_kg, v.max_payload_kg
      using errcode = '22023';
  end if;

  delete from public.vehicle_loads where vehicle_id = v.id;
  insert into public.vehicle_loads (vehicle_id, x_cm, y_cm, length_cm, width_cm, format, weight_kg, status, booking_id, label)
  select v.id, x_cm, y_cm, length_cm, width_cm, format, weight_kg,
         case when booking_id is null then 'OCCUPIED' else 'RESERVED' end, booking_id, nullif(btrim(label), '')
  from _layout order by idx;

  perform public.log_audit(v.company_id, 'LAYOUT_SAVED', 'vehicle', v.id,
    jsonb_build_object('pallets', v_count, 'own_weight_kg', v_own_kg));
end $$;

-- Cursa planificată. p_route = GeoJSON LineString (de la OSRM); dacă lipsește
-- se folosește linia dreaptă între centrele raioanelor.
create function public.set_vehicle_trip(
  p_vehicle uuid, p_origin text, p_destination text, p_departure timestamptz,
  p_route jsonb default null, p_distance_km numeric default null, p_duration_min int default null
) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v public.vehicles;
  o geography; d geography;
  g geometry;
begin
  select * into v from public.vehicles where id = p_vehicle for update;
  if not found or v.company_id is distinct from public.current_company_id() then
    raise exception 'Vehicul inexistent sau fără drept de modificare.' using errcode = '42501';
  end if;
  select center into o from public.districts where id = p_origin;
  select center into d from public.districts where id = p_destination;
  if o is null or d is null or p_origin = p_destination then
    raise exception 'Alege două raioane diferite pentru cursă.' using errcode = '22023';
  end if;
  if p_departure is null or p_departure < now() - interval '1 day' or p_departure > now() + interval '60 days' then
    raise exception 'Data plecării trebuie să fie în următoarele 60 de zile.' using errcode = '22023';
  end if;

  if p_route is null then
    g := ST_MakeLine(o::geometry, d::geometry);
  else
    begin
      g := ST_SetSRID(ST_GeomFromGeoJSON(p_route::text), 4326);
    exception when others then
      raise exception 'Traseu GeoJSON invalid.' using errcode = '22023';
    end;
    if GeometryType(g) <> 'LINESTRING' or ST_NPoints(g) < 2 or ST_NPoints(g) > 50000 then
      raise exception 'Traseul trebuie să fie o linie (LineString) cu 2–50000 de puncte.' using errcode = '22023';
    end if;
    if ST_Distance(ST_StartPoint(g)::geography, o) > 30000 or ST_Distance(ST_EndPoint(g)::geography, d) > 30000 then
      raise exception 'Traseul nu pornește/nu ajunge în raioanele alese.' using errcode = '22023';
    end if;
    g := ST_SimplifyPreserveTopology(g, 0.0003); -- ~30 m, reduce mărimea fără a schimba traseul
  end if;

  update public.vehicles set
    trip_origin_id = p_origin,
    trip_destination_id = p_destination,
    trip_departure_at = p_departure,
    trip_route = g,
    trip_distance_km = coalesce(p_distance_km, round((ST_Length(g::geography) / 1000)::numeric, 1)),
    trip_duration_min = coalesce(p_duration_min, round(ST_Length(g::geography) / 1000 / 60 * 60)::int)
  where id = v.id;

  perform public.log_audit(v.company_id, 'TRIP_SET', 'vehicle', v.id,
    jsonb_build_object('origin', p_origin, 'destination', p_destination, 'departure', p_departure));
end $$;

create function public.clear_vehicle_trip(p_vehicle uuid) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  update public.vehicles set trip_origin_id = null, trip_destination_id = null, trip_departure_at = null,
         trip_route = null, trip_distance_km = null, trip_duration_min = null
  where id = p_vehicle and company_id = public.current_company_id();
  if not found then raise exception 'Vehicul inexistent sau fără drept de modificare.' using errcode = '42501'; end if;
end $$;

-- Token GPS: se afișează o singură dată; în baza de date rămâne doar hash-ul.
create function public.issue_device_token(p_vehicle uuid) returns text
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_token text := encode(gen_random_bytes(32), 'hex');
  v_company uuid;
begin
  select company_id into v_company from public.vehicles where id = p_vehicle;
  if v_company is null or v_company is distinct from public.current_company_id() or not public.is_company_admin() then
    raise exception 'Doar administratorul companiei poate emite tokenuri GPS.' using errcode = '42501';
  end if;
  insert into public.vehicle_devices (vehicle_id, token_hash)
  values (p_vehicle, encode(digest(v_token, 'sha256'), 'hex'))
  on conflict (vehicle_id) do update set token_hash = excluded.token_hash, created_at = now();
  perform public.log_audit(v_company, 'GPS_TOKEN_ISSUED', 'vehicle', p_vehicle);
  return v_token;
end $$;

-- Apelat de trackerul GPS (prin /api/telemetry). Maxim o poziție la 5 secunde.
create function public.ingest_position(p_token text, p_lat double precision, p_lon double precision,
                                       p_speed numeric default null, p_heading int default null)
returns boolean
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_id uuid;
  v_point geography;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then return false; end if;
  if p_lat not between -90 and 90 or p_lon not between -180 and 180 then return false; end if;

  select vehicle_id into v_id from public.vehicle_devices where token_hash = encode(digest(p_token, 'sha256'), 'hex');
  if v_id is null then return false; end if;

  v_point := ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography;
  update public.vehicles set
    position = v_point,
    speed_kmh = case when p_speed between 0 and 200 then p_speed end,
    heading = case when p_heading between 0 and 359 then p_heading end,
    position_at = now(),
    district_id = (select id from public.districts where ST_DWithin(center, v_point, 40000)
                   order by center <-> v_point limit 1)
  where id = v_id and (position_at is null or position_at < now() - interval '5 seconds');
  return found;
end $$;

-- ═══ Căutare (K4) ══════════════════════════════════════════════════════════
-- DIRECT   – cursa vehiculului e exact A→B
-- TRANSIT  – traseul trece la ≤ p_corridor_km de A și de B, în ordinea corectă
-- NEARBY   – trece la ≤ 2×p_corridor_km (vehicul „adiacent”, cu mic ocol)
-- AT_ORIGIN – vehicul liber, fără cursă, aflat acum în raionul A
-- Filtru de capacitate STRICT: free_pallets > p_min_free (K4.3).
-- SECURITY INVOKER: RLS decide ce vehicule vede apelantul.
create function public.search_trips(
  p_origin text default null, p_destination text default null, p_min_free int default 0,
  p_with_transit boolean default true, p_body_type text default null, p_corridor_km numeric default 20
) returns table (
  vehicle_id uuid, match_type text, eta_origin timestamptz, eta_destination timestamptz,
  offset_km numeric, plate text, make_model text, body_type text, company_id uuid, company_name text,
  free_pallets int, pallet_capacity int, price_per_km numeric, lat double precision, lon double precision,
  trip_origin_id text, trip_destination_id text, trip_departure_at timestamptz
)
language sql stable set search_path = public, extensions, pg_temp as $$
  with o as (select center::geometry as g from public.districts where id = p_origin),
       d as (select center::geometry as g from public.districts where id = p_destination),
  base as (
    select v.*, c.name as company_name,
           (select g from o) as og, (select g from d) as dg
    from public.vehicles v join public.companies c on c.id = v.company_id
    where v.is_listed and v.status in ('AVAILABLE', 'ON_ROUTE')
      and v.free_pallets > greatest(coalesce(p_min_free, 0), 0)
      and (p_body_type is null or v.body_type = p_body_type)
      and (p_origin is not null or p_destination is not null)
  ),
  routed as (
    select b.*,
      case when og is not null then ST_LineLocatePoint(trip_route, og) end as fo,
      case when dg is not null then ST_LineLocatePoint(trip_route, dg) end as fd,
      case when og is not null then ST_Distance(trip_route::geography, og::geography) / 1000 end as off_o,
      case when dg is not null then ST_Distance(trip_route::geography, dg::geography) / 1000 end as off_d,
      case when position is not null and position_at > now() - interval '30 minutes'
           then ST_LineLocatePoint(trip_route, position::geometry) end as fp
    from base b
    where trip_route is not null
      and trip_departure_at + make_interval(mins => coalesce(trip_duration_min, 0)) > now()
      and (og is null or ST_DWithin(trip_route::geography, og::geography, p_corridor_km * 2000))
      and (dg is null or ST_DWithin(trip_route::geography, dg::geography, p_corridor_km * 2000))
  ),
  classified as (
    select r.*,
      case
        when (p_origin is null or trip_origin_id = p_origin) and (p_destination is null or trip_destination_id = p_destination) then 'DIRECT'
        when (fo is null or fd is null or fo < fd) and coalesce(off_o, 0) <= p_corridor_km and coalesce(off_d, 0) <= p_corridor_km then 'TRANSIT'
        when (fo is null or fd is null or fo < fd) then 'NEARBY'
      end as mt,
      -- Ora de trecere nu poate fi înaintea plecării: cu GPS proaspăt se ia
      -- maximul dintre estimarea din orar și cea din poziția curentă.
      case
        when fo is null then null
        when fp is not null and fp <= fo then greatest(
          trip_departure_at + make_interval(mins => (fo * trip_duration_min)::int),
          now() + make_interval(mins => ((fo - fp) * trip_duration_min)::int))
        else trip_departure_at + make_interval(mins => (fo * trip_duration_min)::int)
      end as eta_o,
      case
        when fd is null then null
        when fp is not null and fp <= fd then greatest(
          trip_departure_at + make_interval(mins => (fd * trip_duration_min)::int),
          now() + make_interval(mins => ((fd - fp) * trip_duration_min)::int))
        else trip_departure_at + make_interval(mins => (fd * trip_duration_min)::int)
      end as eta_d
    from routed r
  ),
  matches as (
    select id, mt, eta_o, eta_d, round(greatest(coalesce(off_o, 0), coalesce(off_d, 0))::numeric, 1) as off_km,
           plate, make_model, body_type, company_id, company_name, free_pallets, pallet_capacity, price_per_km,
           position, trip_origin_id, trip_destination_id, trip_departure_at
    from classified
    where mt is not null
      and (p_with_transit or mt = 'DIRECT')
      and (eta_o is null or eta_o > now() - interval '15 minutes')   -- nu a trecut deja de A
    union all
    select id, 'AT_ORIGIN', null, null, 0, plate, make_model, body_type, company_id, company_name, free_pallets,
           pallet_capacity, price_per_km, position, trip_origin_id, trip_destination_id, trip_departure_at
    from base
    where p_origin is not null and trip_route is null and status = 'AVAILABLE' and district_id = p_origin
  )
  select id, mt, eta_o, eta_d, off_km, plate, make_model, body_type, company_id, company_name, free_pallets,
         pallet_capacity, price_per_km, ST_Y(position::geometry), ST_X(position::geometry),
         trip_origin_id, trip_destination_id, trip_departure_at
  from matches
  order by array_position(array['DIRECT', 'TRANSIT', 'AT_ORIGIN', 'NEARBY'], mt), eta_o nulls last, off_km
  limit 100
$$;

-- K4.4: vehicule cu locuri libere care trec pe lângă sediul companiei în 24h.
create function public.vehicles_passing_near_me(p_radius_km numeric default 15, p_min_free int default 1)
returns table (vehicle_id uuid, plate text, company_name text, free_pallets int, eta timestamptz,
               distance_km numeric, trip_origin_id text, trip_destination_id text)
language sql stable set search_path = public, extensions, pg_temp as $$
  with me as (
    select location::geometry as g from public.companies
    where id = public.current_company_id() and location is not null
  ),
  near as (
    select v.id, v.plate, c.name, v.free_pallets, v.trip_origin_id, v.trip_destination_id,
           ST_LineLocatePoint(v.trip_route, me.g) as f,
           ST_Distance(v.trip_route::geography, me.g::geography) / 1000 as km,
           v.trip_departure_at, v.trip_duration_min
    from public.vehicles v join public.companies c on c.id = v.company_id, me
    where v.is_listed and v.free_pallets >= p_min_free and v.trip_route is not null
      and v.company_id <> public.current_company_id()
      and ST_DWithin(v.trip_route::geography, me.g::geography, p_radius_km * 1000)
  )
  select id, plate, name, free_pallets,
         trip_departure_at + make_interval(mins => (f * coalesce(trip_duration_min, 0))::int) as eta,
         round(km::numeric, 1), trip_origin_id, trip_destination_id
  from near
  where trip_departure_at + make_interval(mins => (f * coalesce(trip_duration_min, 0))::int)
        between now() and now() + interval '24 hours'
  order by eta
  limit 5
$$;

-- ═══ Rezervări, negociere, contract (K8–K12) ═══════════════════════════════

-- Blochează rezervarea (FOR UPDATE) și verifică că apelantul e parte.
-- Întoarce latura apelantului: SHIPPER sau CARRIER.
create function public._booking_side(p_booking uuid) returns text
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  me uuid := public.current_company_id();
  b public.bookings;
begin
  select * into b from public.bookings where id = p_booking for update;
  if not found or me is null or me not in (b.shipper_company_id, b.carrier_company_id) then
    raise exception 'Rezervare inexistentă.' using errcode = '42501';
  end if;
  return case when me = b.shipper_company_id then 'SHIPPER' else 'CARRIER' end;
end $$;

-- K10: rezervare atomică. Rândul vehiculului e blocat (FOR UPDATE), deci două
-- contracte simultane pe același camion se serializează; al doilea eșuează.
create function public._reserve_capacity(p_booking uuid) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  b public.bookings;
  v public.vehicles;
begin
  select * into b from public.bookings where id = p_booking;
  if b.capacity_reserved then return; end if;
  select * into v from public.vehicles where id = b.vehicle_id for update;
  if v.free_pallets < b.pallets then
    raise exception 'Vehiculul mai are doar % paleți liberi; rezervarea cere %.', v.free_pallets, b.pallets
      using errcode = 'P0001';
  end if;
  if v.occupied_weight_kg + v.booked_weight_kg + b.weight_kg > v.max_payload_kg then
    raise exception 'Sarcina maximă a vehiculului ar fi depășită.' using errcode = 'P0001';
  end if;
  update public.vehicles set booked_pallets = booked_pallets + b.pallets,
                             booked_weight_kg = booked_weight_kg + b.weight_kg
  where id = v.id;
  update public.bookings set capacity_reserved = true where id = b.id;
end $$;

create function public._release_capacity(p_booking uuid) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare b public.bookings;
begin
  select * into b from public.bookings where id = p_booking;
  if not b.capacity_reserved then return; end if;
  perform 1 from public.vehicles where id = b.vehicle_id for update;
  delete from public.vehicle_loads where booking_id = b.id;
  update public.vehicles set booked_pallets = greatest(booked_pallets - b.pallets, 0),
                             booked_weight_kg = greatest(booked_weight_kg - b.weight_kg, 0)
  where id = b.vehicle_id;
  update public.bookings set capacity_reserved = false where id = b.id;
end $$;

-- K8: cerere de paleți pe un vehicul (expeditor) sau ofertă pe o cerere (transportator).
-- K12: fără preț explicit, se propune automat preț/km × distanța rutieră estimată.
create function public.propose_booking(
  p_vehicle uuid, p_pallets int, p_weight_kg int, p_pickup text, p_dropoff text,
  p_pickup_at timestamptz default null, p_price numeric default null,
  p_request uuid default null, p_message text default null
) returns uuid
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  me uuid := public.current_company_id();
  v public.vehicles;
  r public.freight_requests;
  v_side text;
  v_shipper uuid;
  v_price numeric := p_price;
  v_km numeric;
  v_id uuid;
begin
  if me is null then raise exception 'Autentificare necesară.' using errcode = '42501'; end if;
  if not public.current_company_is_verified() then
    raise exception 'Compania ta trebuie verificată (KYC) înainte de a rezerva.' using errcode = '42501';
  end if;
  if p_pallets is null or p_pallets < 1 or p_weight_kg is null or p_weight_kg < 1 then
    raise exception 'Indică numărul de paleți și greutatea.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.districts where id = p_pickup)
     or not exists (select 1 from public.districts where id = p_dropoff) then
    raise exception 'Raion de preluare/livrare necunoscut.' using errcode = '22023';
  end if;
  if v_price is not null and (v_price < 0 or v_price > 10000000) then
    raise exception 'Preț invalid.' using errcode = '22023';
  end if;

  select * into v from public.vehicles where id = p_vehicle;
  if not found then raise exception 'Vehicul inexistent.' using errcode = 'P0002'; end if;

  if v.company_id = me then
    v_side := 'CARRIER';
    select * into r from public.freight_requests where id = p_request and status = 'OPEN' and company_id <> me;
    if not found then raise exception 'Ofertele transportatorului se fac pe o cerere deschisă a altei companii.' using errcode = '22023'; end if;
    v_shipper := r.company_id;
  else
    v_side := 'SHIPPER';
    if not v.is_listed or not exists (select 1 from public.companies where id = v.company_id and kyc_status = 'VERIFIED') then
      raise exception 'Vehiculul nu e disponibil în bursă.' using errcode = '42501';
    end if;
    v_shipper := me;
    if p_request is not null then
      select * into r from public.freight_requests where id = p_request and company_id = me and status = 'OPEN';
      if not found then raise exception 'Cererea nu îți aparține sau nu mai e deschisă.' using errcode = '22023'; end if;
    end if;
  end if;

  if p_pallets > v.free_pallets then
    raise exception 'Vehiculul are doar % paleți liberi.', v.free_pallets using errcode = 'P0001';
  end if;
  if p_weight_kg > v.max_payload_kg - v.occupied_weight_kg - v.booked_weight_kg then
    raise exception 'Greutatea depășește sarcina disponibilă a vehiculului.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.bookings where vehicle_id = v.id and shipper_company_id = v_shipper
             and request_id is not distinct from p_request and status in ('NEGOTIATING', 'AGREED')) then
    raise exception 'Există deja o negociere deschisă pentru acest vehicul.' using errcode = '23505';
  end if;

  if v_price is null and v.price_per_km is not null then
    select round((ST_Distance(a.center, b.center) / 1000 * 1.3)::numeric, 1) into v_km
    from public.districts a, public.districts b where a.id = p_pickup and b.id = p_dropoff;
    v_price := greatest(round(v.price_per_km * v_km * least(1.0, p_pallets::numeric / greatest(v.pallet_capacity, 1) + 0.25)), 300);
  end if;

  insert into public.bookings (vehicle_id, request_id, shipper_company_id, carrier_company_id, initiated_by,
                               pallets, weight_kg, pickup_district_id, dropoff_district_id, pickup_at,
                               price_mdl, price_proposed_by)
  values (v.id, r.id, v_shipper, v.company_id, v_side, p_pallets, p_weight_kg, p_pickup, p_dropoff,
          coalesce(p_pickup_at, r.ready_from), v_price, case when v_price is not null then v_side end)
  returning id into v_id;

  if nullif(btrim(p_message), '') is not null then
    insert into public.booking_messages (booking_id, sender_company_id, sender_user_id, body)
    values (v_id, me, auth.uid(), left(btrim(p_message), 1000));
  else
    perform public.notify_company(
      case when v_side = 'SHIPPER' then v.company_id else v_shipper end,
      'BOOKING_PROPOSED',
      case when v_side = 'SHIPPER' then 'Cerere nouă: ' || p_pallets || ' paleți pe ' || v.plate
           else 'Ofertă nouă pentru cererea ta: ' || v.plate end,
      coalesce('Preț propus: ' || v_price || ' MDL', 'Fără preț propus'),
      '/bookings/' || v_id);
  end if;

  perform public.log_audit(me, 'BOOKING_PROPOSED', 'booking', v_id,
    jsonb_build_object('vehicle', v.id, 'pallets', p_pallets, 'price_mdl', v_price, 'side', v_side));
  return v_id;
end $$;

create function public.accept_price(p_booking uuid) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare b public.bookings; v_side text;
begin
  v_side := public._booking_side(p_booking);
  select * into b from public.bookings where id = p_booking;
  if b.status <> 'NEGOTIATING' or b.price_mdl is null then
    raise exception 'Nu există un preț de acceptat.' using errcode = '22023';
  end if;
  if b.price_proposed_by = v_side then
    raise exception 'Prețul propus de tine trebuie acceptat de cealaltă parte.' using errcode = '22023';
  end if;
  update public.bookings set status = 'AGREED' where id = b.id;
  perform public.notify_company(case when v_side = 'SHIPPER' then b.carrier_company_id else b.shipper_company_id end,
    'PRICE_ACCEPTED', 'Preț acceptat: ' || b.price_mdl || ' MDL', 'Alegeți modul de contractare.', '/bookings/' || b.id);
  perform public.log_audit(public.current_company_id(), 'PRICE_ACCEPTED', 'booking', b.id,
    jsonb_build_object('price_mdl', b.price_mdl));
end $$;

-- K9: alegerea căii. PLATFORM → contract generat din datele KYC (K12) + hash
-- SHA-256; DIRECT → obligatoriu acceptarea explicită a exonerării.
create function public.choose_contract_path(p_booking uuid, p_path text, p_disclaimer_accepted boolean default false,
                                            p_payment_terms_days int default 14)
returns text
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  b public.bookings; v_side text;
  s public.companies; c public.companies; v public.vehicles;
  snap jsonb;
begin
  v_side := public._booking_side(p_booking);
  select * into b from public.bookings where id = p_booking;
  if b.status <> 'AGREED' then
    raise exception 'Calea se alege după acceptarea prețului.' using errcode = '22023';
  end if;
  if p_path not in ('PLATFORM', 'DIRECT') then
    raise exception 'Cale necunoscută.' using errcode = '22023';
  end if;
  if p_payment_terms_days is null or p_payment_terms_days not between 0 and 90 then
    raise exception 'Termenul de plată trebuie să fie între 0 și 90 de zile.' using errcode = '22023';
  end if;
  update public.bookings set payment_terms_days = p_payment_terms_days where id = b.id;
  b.payment_terms_days := p_payment_terms_days;

  if p_path = 'DIRECT' then
    if not coalesce(p_disclaimer_accepted, false) then
      raise exception 'Pentru înțelegerea directă trebuie să confirmi că platforma NU își asumă răspunderea pentru marfă.'
        using errcode = '22023';
    end if;
    update public.bookings set path = 'DIRECT', contract_snapshot = null, contract_hash = null,
           disclaimer_accepted_at = now(), disclaimer_accepted_by = auth.uid(),
           shipper_signed_at = null, shipper_signed_by = null, carrier_signed_at = null, carrier_signed_by = null
    where id = b.id;
    perform public.log_audit(public.current_company_id(), 'PATH_DIRECT_DISCLAIMER_ACCEPTED', 'booking', b.id,
      jsonb_build_object('side', v_side));
    return null;
  end if;

  select * into s from public.companies where id = b.shipper_company_id;
  select * into c from public.companies where id = b.carrier_company_id;
  select * into v from public.vehicles where id = b.vehicle_id;
  snap := jsonb_build_object(
    'template', 'OptiFleet contract de transport B2B v2026.1',
    'booking_id', b.id,
    'issued_at', now(),
    'shipper', jsonb_build_object('name', s.name, 'legal_form', s.legal_form, 'idno', s.idno, 'address', s.address),
    'carrier', jsonb_build_object('name', c.name, 'legal_form', c.legal_form, 'idno', c.idno, 'address', c.address),
    'vehicle', jsonb_build_object('plate', v.plate, 'make_model', v.make_model, 'body_type', v.body_type),
    'cargo', jsonb_build_object('pallets', b.pallets, 'weight_kg', b.weight_kg),
    'route', jsonb_build_object('pickup', b.pickup_district_id, 'dropoff', b.dropoff_district_id, 'pickup_at', b.pickup_at),
    'price_mdl', b.price_mdl,
    'payment_terms_days', b.payment_terms_days,
    'clauses', jsonb_build_array(
      format('Plata se efectuează în cel mult %s zile de la confirmarea livrării.', b.payment_terms_days),
      'Contractul se încheie conform Codului transporturilor rutiere nr. 150/2014 al Republicii Moldova.',
      'Transportatorul răspunde de integritatea mărfii de la preluare până la livrare.',
      'Expeditorul are acces la poziția GPS a vehiculului pe toată durata cursei.',
      'Livrarea se consideră finalizată doar după confirmarea ambelor părți și încărcarea dovezii foto.',
      'Datele cu caracter personal se prelucrează conform Legii nr. 133/2011.'
    )
  );
  update public.bookings set path = 'PLATFORM', contract_snapshot = snap,
         contract_hash = encode(digest(snap::text, 'sha256'), 'hex'),
         disclaimer_accepted_at = null, disclaimer_accepted_by = null,
         shipper_signed_at = null, shipper_signed_by = null, carrier_signed_at = null, carrier_signed_by = null
  where id = b.id;
  perform public.log_audit(public.current_company_id(), 'PATH_PLATFORM_CONTRACT_GENERATED', 'booking', b.id,
    jsonb_build_object('hash', encode(digest(snap::text, 'sha256'), 'hex')));
  return encode(digest(snap::text, 'sha256'), 'hex');
end $$;

-- Semnare / confirmare. Când ambele părți au semnat → capacitate rezervată
-- atomic și contract activ. Pentru DIRECT, și a doua parte confirmă exonerarea.
create function public.sign_booking(p_booking uuid, p_disclaimer_accepted boolean default false) returns text
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare b public.bookings; v_side text;
begin
  v_side := public._booking_side(p_booking);
  select * into b from public.bookings where id = p_booking;
  if b.status <> 'AGREED' or b.path is null then
    raise exception 'Nu există un contract de semnat.' using errcode = '22023';
  end if;
  if b.path = 'DIRECT' and not coalesce(p_disclaimer_accepted, false) then
    raise exception 'Confirmă că platforma NU își asumă răspunderea pentru marfa transportată.' using errcode = '22023';
  end if;
  if b.path = 'PLATFORM' and (b.contract_hash is null
     or b.contract_hash <> encode(digest(b.contract_snapshot::text, 'sha256'), 'hex')) then
    raise exception 'Integritatea contractului nu poate fi verificată.' using errcode = 'P0001';
  end if;

  if v_side = 'SHIPPER' then
    update public.bookings set shipper_signed_at = now(), shipper_signed_by = auth.uid() where id = b.id;
  else
    update public.bookings set carrier_signed_at = now(), carrier_signed_by = auth.uid() where id = b.id;
  end if;
  perform public.log_audit(public.current_company_id(),
    case when b.path = 'DIRECT' then 'DIRECT_CONFIRMED' else 'CONTRACT_SIGNED' end, 'booking', b.id,
    jsonb_build_object('side', v_side, 'hash', b.contract_hash, 'disclaimer', b.path = 'DIRECT'));

  select * into b from public.bookings where id = b.id;
  if b.shipper_signed_at is not null and b.carrier_signed_at is not null then
    perform public._reserve_capacity(b.id);
    update public.bookings set status = 'CONTRACTED' where id = b.id;
    if b.request_id is not null then
      update public.freight_requests set status = 'BOOKED' where id = b.request_id and status = 'OPEN';
    end if;
    perform public.notify_company(b.shipper_company_id, 'CONTRACTED', 'Contract activ', 'Capacitatea a fost rezervată.', '/bookings/' || b.id);
    perform public.notify_company(b.carrier_company_id, 'CONTRACTED', 'Contract activ', 'Capacitatea a fost rezervată.', '/bookings/' || b.id);
    return 'CONTRACTED';
  end if;

  perform public.notify_company(case when v_side = 'SHIPPER' then b.carrier_company_id else b.shipper_company_id end,
    'SIGNATURE_REQUIRED', 'Cealaltă parte a semnat', 'Semnătura ta finalizează contractul.', '/bookings/' || b.id);
  return 'AGREED';
end $$;

create function public.start_transit(p_booking uuid) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare b public.bookings; v_side text;
begin
  v_side := public._booking_side(p_booking);
  select * into b from public.bookings where id = p_booking;
  if v_side <> 'CARRIER' or b.status <> 'CONTRACTED' then
    raise exception 'Doar transportatorul pornește cursa unui contract activ.' using errcode = '22023';
  end if;
  update public.bookings set status = 'IN_TRANSIT' where id = b.id;
  update public.vehicles set status = 'ON_ROUTE' where id = b.vehicle_id;
  if b.request_id is not null then
    update public.freight_requests set status = 'IN_TRANSIT' where id = b.request_id;
  end if;
  perform public.notify_company(b.shipper_company_id, 'IN_TRANSIT', 'Marfa ta e în drum', 'Poți urmări vehiculul pe hartă.', '/bookings/' || b.id);
  perform public.log_audit(public.current_company_id(), 'TRANSIT_STARTED', 'booking', b.id);
end $$;

-- K11: fișierul e deja urcat în bucket-ul privat delivery-proofs/<booking>/<uuid>.<ext>
create function public.record_delivery_proof(p_booking uuid, p_storage_path text, p_lat double precision,
                                             p_lon double precision, p_taken_at timestamptz)
returns uuid
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare b public.bookings; v_side text; v_id uuid;
begin
  v_side := public._booking_side(p_booking);
  select * into b from public.bookings where id = p_booking;
  if v_side <> 'CARRIER' or b.status not in ('CONTRACTED', 'IN_TRANSIT') then
    raise exception 'Doar transportatorul încarcă dovada, pentru o cursă activă.' using errcode = '22023';
  end if;
  if p_storage_path !~ ('^' || b.id || '/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$') then
    raise exception 'Cale de fișier invalidă.' using errcode = '22023';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'delivery-proofs' and name = p_storage_path) then
    raise exception 'Fotografia nu a fost găsită în stocare.' using errcode = 'P0002';
  end if;
  if p_taken_at is null or p_taken_at not between now() - interval '2 days' and now() + interval '10 minutes' then
    raise exception 'Data fotografiei nu e plauzibilă.' using errcode = '22023';
  end if;
  insert into public.delivery_proofs (booking_id, storage_path, lat, lon, taken_at, uploaded_by)
  values (b.id, p_storage_path,
          case when p_lat between -90 and 90 then p_lat end,
          case when p_lon between -180 and 180 then p_lon end,
          p_taken_at, auth.uid())
  returning id into v_id;
  perform public.notify_company(b.shipper_company_id, 'DELIVERY_PROOF', 'Dovadă foto de livrare', 'Verifică fotografia și confirmă recepția.', '/bookings/' || b.id);
  perform public.log_audit(public.current_company_id(), 'DELIVERY_PROOF_UPLOADED', 'booking', b.id,
    jsonb_build_object('path', p_storage_path, 'lat', p_lat, 'lon', p_lon, 'taken_at', p_taken_at));
  return v_id;
end $$;

-- K9: PLATFORM → finalizat doar după confirmarea AMBELOR părți (și poza, pentru
-- transportator). DIRECT → platforma nu mediază; prima confirmare închide cursa.
create function public.confirm_delivery(p_booking uuid) returns text
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare b public.bookings; v_side text;
begin
  v_side := public._booking_side(p_booking);
  select * into b from public.bookings where id = p_booking;
  if b.status not in ('IN_TRANSIT', 'CONTRACTED') then
    raise exception 'Cursa nu e activă.' using errcode = '22023';
  end if;
  if b.path = 'PLATFORM' and b.status <> 'IN_TRANSIT' then
    raise exception 'Livrarea se confirmă după pornirea cursei.' using errcode = '22023';
  end if;
  if b.path = 'PLATFORM' and v_side = 'CARRIER'
     and not exists (select 1 from public.delivery_proofs where booking_id = b.id) then
    raise exception 'Încarcă întâi fotografia de la livrare.' using errcode = '22023';
  end if;

  if v_side = 'SHIPPER' then
    update public.bookings set shipper_delivery_confirmed_at = coalesce(shipper_delivery_confirmed_at, now()) where id = b.id;
  else
    update public.bookings set carrier_delivery_confirmed_at = coalesce(carrier_delivery_confirmed_at, now()) where id = b.id;
  end if;
  perform public.log_audit(public.current_company_id(), 'DELIVERY_CONFIRMED', 'booking', b.id, jsonb_build_object('side', v_side));

  select * into b from public.bookings where id = b.id;
  if b.path = 'DIRECT' or (b.shipper_delivery_confirmed_at is not null and b.carrier_delivery_confirmed_at is not null) then
    perform public._release_capacity(b.id);
    update public.bookings set status = 'DELIVERED', delivered_at = now() where id = b.id;
    if b.request_id is not null then
      update public.freight_requests set status = 'DELIVERED' where id = b.request_id;
    end if;
    perform public.notify_company(b.shipper_company_id, 'DELIVERED', 'Livrare finalizată', null, '/bookings/' || b.id);
    perform public.notify_company(b.carrier_company_id, 'DELIVERED', 'Livrare finalizată', null, '/bookings/' || b.id);
    return 'DELIVERED';
  end if;

  perform public.notify_company(case when v_side = 'SHIPPER' then b.carrier_company_id else b.shipper_company_id end,
    'DELIVERY_CONFIRMATION_REQUIRED', 'Confirmă livrarea', 'Cealaltă parte a confirmat livrarea.', '/bookings/' || b.id);
  return b.status;
end $$;

-- Transportatorul confirmă încasarea (termenul de plată din contract, K12).
create function public.confirm_payment(p_booking uuid) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare b public.bookings; v_side text;
begin
  v_side := public._booking_side(p_booking);
  select * into b from public.bookings where id = p_booking;
  if v_side <> 'CARRIER' or b.status <> 'DELIVERED' then
    raise exception 'Doar transportatorul confirmă plata, după livrare.' using errcode = '22023';
  end if;
  if b.paid_confirmed_at is not null then return; end if;
  update public.bookings set paid_confirmed_at = now(), paid_confirmed_by = auth.uid() where id = b.id;
  perform public.notify_company(b.shipper_company_id, 'PAYMENT_CONFIRMED', 'Plata a fost confirmată de transportator', null, '/bookings/' || b.id);
  perform public.log_audit(public.current_company_id(), 'PAYMENT_CONFIRMED', 'booking', b.id);
end $$;

create function public.cancel_booking(p_booking uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare b public.bookings; v_side text;
begin
  v_side := public._booking_side(p_booking);
  select * into b from public.bookings where id = p_booking;
  if b.status not in ('NEGOTIATING', 'AGREED', 'CONTRACTED') then
    raise exception 'Rezervarea nu mai poate fi anulată în starea curentă.' using errcode = '22023';
  end if;
  perform public._release_capacity(b.id);
  update public.bookings set status = case when b.status = 'NEGOTIATING' and v_side <> b.initiated_by then 'REJECTED' else 'CANCELLED' end
  where id = b.id;
  if b.request_id is not null and b.status = 'CONTRACTED' then
    update public.freight_requests fr set status = 'OPEN'
    where fr.id = b.request_id and fr.status = 'BOOKED'
      and not exists (select 1 from public.bookings x where x.request_id = fr.id and x.id <> b.id and x.status in ('CONTRACTED', 'IN_TRANSIT'));
  end if;
  perform public.notify_company(case when v_side = 'SHIPPER' then b.carrier_company_id else b.shipper_company_id end,
    'BOOKING_CANCELLED', 'Rezervare anulată', left(p_reason, 200), '/bookings/' || b.id);
  perform public.log_audit(public.current_company_id(), 'BOOKING_CANCELLED', 'booking', b.id,
    jsonb_build_object('side', v_side, 'reason', left(p_reason, 200), 'previous_status', b.status));
end $$;

create function public.cancel_request(p_request uuid) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare r public.freight_requests; x record;
begin
  select * into r from public.freight_requests where id = p_request for update;
  if not found or r.company_id is distinct from public.current_company_id() then
    raise exception 'Cerere inexistentă.' using errcode = '42501';
  end if;
  if r.status <> 'OPEN' then
    raise exception 'Doar cererile deschise pot fi anulate; anulează întâi contractul.' using errcode = '22023';
  end if;
  update public.freight_requests set status = 'CANCELLED' where id = r.id;
  for x in select id, carrier_company_id from public.bookings where request_id = r.id and status in ('NEGOTIATING', 'AGREED') loop
    update public.bookings set status = 'CANCELLED' where id = x.id;
    perform public.notify_company(x.carrier_company_id, 'REQUEST_CANCELLED', 'Cerere anulată de expeditor', null, '/bookings/' || x.id);
  end loop;
  perform public.log_audit(r.company_id, 'REQUEST_CANCELLED', 'freight_request', r.id);
end $$;

create function public.mark_notifications_read() returns void
language sql security definer set search_path = public, extensions, pg_temp as $$
  update public.notifications set read_at = now()
  where company_id = public.current_company_id() and read_at is null
$$;

-- ═══ Administrare platformă ════════════════════════════════════════════════

create function public.review_company(p_company uuid, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Doar administratorii platformei pot verifica firme.' using errcode = '42501';
  end if;
  if p_status not in ('VERIFIED', 'REJECTED', 'PENDING') then
    raise exception 'Stare KYC invalidă.' using errcode = '22023';
  end if;
  if p_status = 'REJECTED' and nullif(btrim(p_note), '') is null then
    raise exception 'Motivul respingerii este obligatoriu.' using errcode = '22023';
  end if;
  update public.companies set kyc_status = p_status, kyc_note = left(p_note, 500),
         verified_at = case when p_status = 'VERIFIED' then now() end
  where id = p_company;
  if not found then raise exception 'Companie inexistentă.' using errcode = 'P0002'; end if;
  perform public.notify_company(p_company, 'KYC_' || p_status,
    case p_status when 'VERIFIED' then 'Compania ta a fost verificată' when 'REJECTED' then 'Verificarea a fost respinsă' else 'Verificare redeschisă' end,
    p_note, '/account');
  perform public.log_audit(p_company, 'KYC_' || p_status, 'company', p_company, jsonb_build_object('note', left(p_note, 500)));
end $$;

-- Mută cursele demo în „acum”, ca harta să fie vie la fiecare prezentare.
create function public.refresh_demo_trips() returns int
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare n int;
begin
  if not public.is_platform_admin() then
    raise exception 'Doar administratorii platformei.' using errcode = '42501';
  end if;
  with ranked as (
    select v.id, row_number() over (order by v.plate) as rn
    from public.vehicles v join public.companies c on c.id = v.company_id
    where c.is_demo and v.trip_route is not null
  )
  update public.vehicles v set
    trip_departure_at = now() - make_interval(mins => ((r.rn % 4) * 20)::int) + make_interval(mins => ((r.rn % 3) * 35)::int),
    position = ST_LineInterpolatePoint(v.trip_route, least(0.85, greatest(0.0,
                 ((r.rn % 4) * 20 - (r.rn % 3) * 35)::numeric / greatest(v.trip_duration_min, 1))))::geography,
    position_at = now(),
    status = 'ON_ROUTE'
  from ranked r where r.id = v.id;
  get diagnostics n = row_count;
  return n;
end $$;

-- ═══ Drepturi de execuție ══════════════════════════════════════════════════
-- Explicit, funcție cu funcție: nu atingem funcțiile PostGIS (pot fi în public).
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('current_company_id', 'is_platform_admin', 'is_company_admin', 'current_company_is_verified',
                        'log_audit', 'notify_company', 'touch_updated_at', 'handle_new_user',
                        'refresh_vehicle_occupancy', 'vehicle_loads_changed', 'booking_message_price',
                        'save_vehicle_layout', 'set_vehicle_trip', 'clear_vehicle_trip', 'issue_device_token',
                        'ingest_position', 'search_trips', 'vehicles_passing_near_me', '_booking_side',
                        '_reserve_capacity', '_release_capacity', 'propose_booking', 'accept_price',
                        'choose_contract_path', 'sign_booking', 'start_transit', 'record_delivery_proof', 'confirm_payment',
                        'confirm_delivery', 'cancel_booking', 'cancel_request', 'mark_notifications_read',
                        'review_company', 'refresh_demo_trips')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;

grant execute on function public.current_company_id()          to authenticated;
grant execute on function public.is_platform_admin()           to authenticated;
grant execute on function public.is_company_admin()            to authenticated;
grant execute on function public.current_company_is_verified() to authenticated;
grant execute on function public.save_vehicle_layout(uuid, jsonb)                                     to authenticated;
grant execute on function public.set_vehicle_trip(uuid, text, text, timestamptz, jsonb, numeric, int)  to authenticated;
grant execute on function public.clear_vehicle_trip(uuid)                                             to authenticated;
grant execute on function public.issue_device_token(uuid)                                             to authenticated;
grant execute on function public.ingest_position(text, double precision, double precision, numeric, int) to anon, authenticated;
grant execute on function public.search_trips(text, text, int, boolean, text, numeric)                to authenticated;
grant execute on function public.vehicles_passing_near_me(numeric, int)                               to authenticated;
grant execute on function public.propose_booking(uuid, int, int, text, text, timestamptz, numeric, uuid, text) to authenticated;
grant execute on function public.accept_price(uuid)                                                   to authenticated;
grant execute on function public.choose_contract_path(uuid, text, boolean, int)                       to authenticated;
grant execute on function public.confirm_payment(uuid)                                                to authenticated;
grant execute on function public.sign_booking(uuid, boolean)                                          to authenticated;
grant execute on function public.start_transit(uuid)                                                  to authenticated;
grant execute on function public.record_delivery_proof(uuid, text, double precision, double precision, timestamptz) to authenticated;
grant execute on function public.confirm_delivery(uuid)                                               to authenticated;
grant execute on function public.cancel_booking(uuid, text)                                           to authenticated;
grant execute on function public.cancel_request(uuid)                                                 to authenticated;
grant execute on function public.mark_notifications_read()                                            to authenticated;
grant execute on function public.review_company(uuid, text, text)                                     to authenticated;
grant execute on function public.refresh_demo_trips()                                                 to authenticated;
-- Funcțiile interne (_booking_side, _reserve_*, _release_*, log_audit, notify_company,
-- refresh_vehicle_occupancy, triggere) rămân fără EXECUTE pentru clienți.
