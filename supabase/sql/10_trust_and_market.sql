-- ═══════════════════════════════════════════════════════════════════════════
-- OptiFleet v2 — 10: încredere și piață (practici preluate din bursele de marfă)
--
--   • recenzii după livrare + scor de încredere al firmei   (Lardi-Trans, Trans.eu)
--   • preț de referință pe coridor, din contracte reale     (Uber Freight: preț instant)
--   • potriviri pentru drumul gol de întoarcere             (toate bursele)
--   • documente KYC: licență ANTA, poliță CMR, extras       (Timocom / Trans.eu: verificare)
-- ═══════════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- ─── Recenzii ─────────────────────────────────────────────────────────────
create table public.reviews (
  id               uuid primary key default gen_random_uuid(),
  booking_id       uuid not null references public.bookings (id) on delete cascade,
  from_company_id  uuid not null references public.companies (id),
  to_company_id    uuid not null references public.companies (id),
  score            smallint not null check (score between 1 and 5),
  on_time          boolean,
  cargo_ok         boolean,
  comment          text check (char_length(comment) <= 500),
  created_at       timestamptz not null default now(),
  unique (booking_id, from_company_id)
);
create index reviews_to_idx on public.reviews (to_company_id, created_at desc);

alter table public.reviews enable row level security;
revoke all on public.reviews from anon, authenticated;
grant select on public.reviews to authenticated;
-- Recenziile despre firmele verificate sunt publice pentru utilizatorii autentificați (încredere în bursă).
create policy reviews_read on public.reviews for select to authenticated using (
  to_company_id in (select id from public.companies where kyc_status = 'VERIFIED')
  or from_company_id = (select public.current_company_id())
  or to_company_id = (select public.current_company_id())
);

create function public.submit_review(p_booking uuid, p_score int, p_on_time boolean default null,
                                     p_cargo_ok boolean default null, p_comment text default null)
returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare b public.bookings; v_side text; v_to uuid;
begin
  v_side := public._booking_side(p_booking);
  select * into b from public.bookings where id = p_booking;
  if b.status <> 'DELIVERED' then
    raise exception 'Recenzia se lasă după livrare.' using errcode = '22023';
  end if;
  if b.delivered_at < now() - interval '30 days' then
    raise exception 'Perioada de 30 de zile pentru recenzie a expirat.' using errcode = '22023';
  end if;
  if p_score is null or p_score not between 1 and 5 then
    raise exception 'Nota trebuie să fie între 1 și 5.' using errcode = '22023';
  end if;
  v_to := case when v_side = 'SHIPPER' then b.carrier_company_id else b.shipper_company_id end;
  insert into public.reviews (booking_id, from_company_id, to_company_id, score, on_time, cargo_ok, comment)
  values (b.id, public.current_company_id(), v_to, p_score, p_on_time, p_cargo_ok, nullif(left(btrim(p_comment), 500), ''));
  perform public.notify_company(v_to, 'REVIEW_RECEIVED', 'Ai primit o recenzie: ' || p_score || '/5', left(p_comment, 200), '/account');
  perform public.log_audit(public.current_company_id(), 'REVIEW_SUBMITTED', 'booking', b.id, jsonb_build_object('score', p_score));
exception when unique_violation then
  raise exception 'Ai lăsat deja o recenzie pentru această cursă.' using errcode = '23505';
end $$;

-- ─── Preț de referință pe coridor ─────────────────────────────────────────
-- Din contractele din ultimele 180 de zile. Se publică doar dacă există cel
-- puțin 3 contracte (altfel s-ar putea deduce prețul unei singure firme);
-- altfel se încearcă perechea de regiuni.
create function public.corridor_price_stats(p_origin text, p_destination text)
returns table (scope text, contracts int, median_mdl_per_km numeric, p25_mdl_per_km numeric, p75_mdl_per_km numeric,
               distance_km numeric, suggested_full_truck_mdl numeric)
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
declare
  o public.districts; d public.districts;
  v_km numeric;
begin
  select * into o from public.districts where id = p_origin;
  select * into d from public.districts where id = p_destination;
  if o.id is null or d.id is null then return; end if;
  v_km := round((ST_Distance(o.center, d.center) / 1000 * 1.3)::numeric, 1);

  return query
  with deals as (
    select b.price_mdl / nullif(ST_Distance(po.center, pd.center) / 1000 * 1.3, 0) as per_km,
           b.pickup_district_id = p_origin and b.dropoff_district_id = p_destination as exact
    from public.bookings b
    join public.districts po on po.id = b.pickup_district_id
    join public.districts pd on pd.id = b.dropoff_district_id
    where b.status in ('CONTRACTED', 'IN_TRANSIT', 'DELIVERED')
      and b.price_mdl is not null and b.created_at > now() - interval '180 days'
      and po.region = o.region and pd.region = d.region
      and b.pickup_district_id <> b.dropoff_district_id
  ),
  pick as (
    select case when count(*) filter (where exact) >= 3 then 'CORRIDOR' else 'REGIONS' end as scope from deals
  ),
  sel as (
    select per_km from deals, pick where (pick.scope = 'REGIONS' or exact)
  )
  select pick.scope, count(*)::int,
         round(percentile_cont(0.5) within group (order by per_km)::numeric, 2),
         round(percentile_cont(0.25) within group (order by per_km)::numeric, 2),
         round(percentile_cont(0.75) within group (order by per_km)::numeric, 2),
         v_km,
         round((percentile_cont(0.5) within group (order by per_km) * v_km)::numeric)
  from sel, pick
  group by pick.scope
  having count(*) >= 3;
end $$;

-- ─── Drumul gol de întoarcere ─────────────────────────────────────────────
-- Cereri deschise care pornesc de lângă destinația cursei și merg spre raionul
-- sediului transportatorului, cu fereastră compatibilă cu ora sosirii.
create function public._backhaul_for_vehicle(p_vehicle uuid)
returns table (request_id uuid, origin_district_id text, destination_district_id text, pallets int, weight_kg int,
               ready_from timestamptz, deliver_by timestamptz, budget_mdl numeric, company_name text, detour_km numeric)
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  with v as (
    select v.*, c.location as home, c.id as cid,
           coalesce(dd.center, v.position) as start_point,
           coalesce(v.trip_departure_at + make_interval(mins => coalesce(v.trip_duration_min, 0)), now()) as free_at
    from public.vehicles v
    join public.companies c on c.id = v.company_id
    left join public.districts dd on dd.id = v.trip_destination_id
    where v.id = p_vehicle
  )
  select r.id, r.origin_district_id, r.destination_district_id, r.pallets, r.weight_kg, r.ready_from, r.deliver_by,
         r.budget_mdl, rc.name,
         round((ST_Distance(r.origin_point, v.start_point) / 1000)::numeric, 1)
  from v
  join public.freight_requests r on r.status = 'OPEN' and r.company_id <> v.cid
  join public.companies rc on rc.id = r.company_id and rc.kyc_status = 'VERIFIED'
  where v.start_point is not null and v.home is not null
    and ST_DWithin(r.origin_point, v.start_point, 40000)
    and ST_DWithin(r.destination_point, v.home, 60000)
    and r.pallets <= v.pallet_capacity
    and (r.body_type is null or r.body_type = v.body_type)
    and (not r.needs_reefer or v.has_reefer)
    and r.deliver_by > v.free_at
    and r.ready_from < v.free_at + interval '48 hours'
  order by ST_Distance(r.origin_point, v.start_point)
  limit 20
$$;
revoke execute on function public._backhaul_for_vehicle(uuid) from public, anon, authenticated;

-- Varianta pentru transportator: doar pentru vehiculele proprii.
create function public.backhaul_matches(p_vehicle uuid)
returns table (request_id uuid, origin_district_id text, destination_district_id text, pallets int, weight_kg int,
               ready_from timestamptz, deliver_by timestamptz, budget_mdl numeric, company_name text, detour_km numeric)
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
begin
  if not exists (select 1 from public.vehicles where id = p_vehicle and company_id = public.current_company_id()) then
    raise exception 'Vehicul inexistent sau fără drepturi.' using errcode = '42501';
  end if;
  return query select * from public._backhaul_for_vehicle(p_vehicle);
end $$;

-- ─── Documente KYC ────────────────────────────────────────────────────────
create table public.company_documents (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  doc_type      text not null check (doc_type in ('ANTA_LICENSE', 'CMR_INSURANCE', 'STATE_REGISTRY_EXTRACT', 'OTHER')),
  storage_path  text not null unique check (char_length(storage_path) <= 300),
  doc_number    text check (char_length(doc_number) <= 60),
  expires_on    date,
  status        text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  review_note   text check (char_length(review_note) <= 300),
  reviewed_at   timestamptz,
  uploaded_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index company_documents_company_idx on public.company_documents (company_id);
create index company_documents_expiry_idx on public.company_documents (expires_on) where status = 'APPROVED';

alter table public.company_documents enable row level security;
revoke all on public.company_documents from anon, authenticated;
grant select on public.company_documents to authenticated;
grant insert (company_id, doc_type, storage_path, doc_number, expires_on) on public.company_documents to authenticated;
create policy company_documents_read on public.company_documents for select to authenticated using (
  company_id = (select public.current_company_id()) or (select public.is_platform_admin())
);
create policy company_documents_insert on public.company_documents for insert to authenticated with check (
  company_id = (select public.current_company_id())
  and (select public.is_company_admin())
  and storage_path like company_id::text || '/%'
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kyc-documents', 'kyc-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy kyc_documents_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'kyc-documents'
  and (storage.foldername(name))[1] = (select public.current_company_id())::text
  and (select public.is_company_admin())
);
create policy kyc_documents_read on storage.objects for select to authenticated using (
  bucket_id = 'kyc-documents'
  and ((storage.foldername(name))[1] = (select public.current_company_id())::text or (select public.is_platform_admin()))
);

create function public.review_document(p_document uuid, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare d public.company_documents;
begin
  if not public.is_platform_admin() then
    raise exception 'Doar administratorii platformei.' using errcode = '42501';
  end if;
  if p_status not in ('APPROVED', 'REJECTED') then
    raise exception 'Stare invalidă.' using errcode = '22023';
  end if;
  update public.company_documents set status = p_status, review_note = left(p_note, 300), reviewed_at = now()
  where id = p_document returning * into d;
  if d.id is null then raise exception 'Document inexistent.' using errcode = 'P0002'; end if;
  perform public.notify_company(d.company_id, 'DOCUMENT_' || p_status,
    case p_status when 'APPROVED' then 'Document aprobat' else 'Document respins' end, p_note, '/account');
  perform public.log_audit(d.company_id, 'DOCUMENT_' || p_status, 'company_document', d.id, jsonb_build_object('type', d.doc_type));
end $$;

-- Scor de încredere (agregat, fără date individuale). Public pentru firmele verificate.
create function public.company_trust(p_company uuid)
returns table (deliveries int, reviews int, avg_score numeric, on_time_pct int, member_since timestamptz, kyc_status text,
               anta_valid_until date)
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select
    (select count(*)::int from public.bookings b
      where b.status = 'DELIVERED' and p_company in (b.shipper_company_id, b.carrier_company_id)),
    (select count(*)::int from public.reviews r where r.to_company_id = p_company),
    (select round(avg(r.score)::numeric, 1) from public.reviews r where r.to_company_id = p_company),
    (select round(100.0 * count(*) filter (where r.on_time) / nullif(count(*) filter (where r.on_time is not null), 0))::int
       from public.reviews r where r.to_company_id = p_company),
    c.created_at, c.kyc_status,
    (select max(d.expires_on) from public.company_documents d
      where d.company_id = p_company and d.doc_type = 'ANTA_LICENSE' and d.status = 'APPROVED' and d.expires_on >= current_date)
  from public.companies c
  where c.id = p_company
    and (c.kyc_status = 'VERIFIED' or c.id = public.current_company_id() or public.is_platform_admin())
$$;

-- ─── Drepturi de execuție ─────────────────────────────────────────────────
do $$
declare f regprocedure;
begin
  for f in select p.oid::regprocedure from pg_proc p where p.pronamespace = 'public'::regnamespace
    and p.proname in ('submit_review', 'company_trust', 'corridor_price_stats', 'backhaul_matches', 'review_document')
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
