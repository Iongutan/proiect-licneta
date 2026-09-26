-- ═══════════════════════════════════════════════════════════════════════════
-- OptiFleet v2 — 08: date demo (OPȚIONAL, pentru prezentare)
--
-- Companii fictive (is_demo = true), vehicule cu curse pe coridoarele reale,
-- un vagon de tren și o dronă (flota multimodală),
-- paleți plasați la scară, cereri deschise. Nu creează conturi de utilizator.
-- După o zi cursele „expiră”: adminul le readuce la „acum” din pagina Admin
-- (butonul „Reîmprospătează cursele demo” → refresh_demo_trips()).
-- ═══════════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

begin;

insert into public.companies (id, name, legal_form, idno, kind, district_id, address, location, phone, kyc_status, verified_at, is_demo)
select c.id::uuid, c.name, c.lf, c.idno, c.kind, c.district, c.addr, d.center, c.phone, 'VERIFIED', now(), true
from (values
  ('d0000000-0000-4000-8000-000000000001', 'TransMold Express',    'SRL', '1003600100011', 'CARRIER', 'chisinau',   'str. Uzinelor 14',        '+373 22 400 101'),
  ('d0000000-0000-4000-8000-000000000002', 'LogiSpeed Nord',       'SA',  '1003600100022', 'CARRIER', 'balti',      'str. Ștefan cel Mare 3',  '+373 231 400 22'),
  ('d0000000-0000-4000-8000-000000000003', 'ColdChain Orhei',      'SRL', '1003600100033', 'CARRIER', 'orhei',      'str. Vasile Lupu 40',     '+373 235 400 33'),
  ('d0000000-0000-4000-8000-000000000004', 'SudTrans Agro',        'SRL', '1003600100044', 'CARRIER', 'cahul',      'str. Republicii 12',      '+373 299 400 44'),
  ('d0000000-0000-4000-8000-000000000005', 'Utilaje Grele Bălți',  'SRL', '1003600100055', 'CARRIER', 'balti',      'str. Industrială 7',      '+373 231 400 55'),
  ('d0000000-0000-4000-8000-000000000006', 'Nistru Transport',     'II',  '1003600100066', 'CARRIER', 'soldanesti', 'str. Păcii 2',            '+373 272 400 66'),
  ('d0000000-0000-4000-8000-000000000007', 'Prut Logistica',       'SRL', '1003600100077', 'CARRIER', 'leova',      'str. Independenței 9',    '+373 263 400 77'),
  ('d0000000-0000-4000-8000-000000000008', 'Est Cargo Anenii Noi', 'SRL', '1003600100088', 'CARRIER', 'anenii_noi', 'str. Concordiei 21',      '+373 265 400 88'),
  ('d0000000-0000-4000-8000-000000000009', 'Ungheni Distribuție',  'SRL', '1003600100099', 'CARRIER', 'ungheni',    'str. Națională 5',        '+373 236 400 99'),
  ('d0000000-0000-4000-8000-000000000011', 'Podgoria Nord',        'SRL', '1003600100110', 'SHIPPER', 'chisinau',   'str. Petricani 88',       '+373 22 500 110'),
  ('d0000000-0000-4000-8000-000000000012', 'Agrofructe Sud',       'SRL', '1003600100121', 'SHIPPER', 'chisinau',   'bd. Dacia 51',            '+373 22 500 121'),
  ('d0000000-0000-4000-8000-000000000013', 'Mobila Centru',        'SA',  '1003600100132', 'SHIPPER', 'orhei',      'str. Eliberării 16',      '+373 235 500 13')
) as c(id, name, lf, idno, kind, district, addr, phone)
join public.districts d on d.id = c.district
on conflict (id) do nothing;

-- Vehicule: ruta demo = linia prin centrele raioanelor de pe coridor.
with spec (id, company, plate, make_model, body, l, w, h, payload, pallets, reefer, price, via, dist_now, status) as (values
  ('d1000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'CAN 001', 'Mercedes-Benz Actros 1845', 'CURTAINSIDE', 1360, 245, 270, 24000, 33, false, 18.5, array['chisinau','orhei','soldanesti','rezina'],             'chisinau',   'ON_ROUTE'),
  ('d1000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000001', 'CAN 118', 'Mercedes-Benz Sprinter 316','VAN',          420, 178, 190,  1300,  5, false, 11.0, array['chisinau','ialoveni','hincesti'],                    'chisinau',   'ON_ROUTE'),
  ('d1000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000002', 'BLT 402', 'MAN TGX 18.500 + remorcă',  'ROAD_TRAIN',  1540, 248, 300, 24000, 36, false, 22.0, array['balti','singerei','orhei','chisinau'],                'balti',      'ON_ROUTE'),
  ('d1000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000003', 'ORH 404', 'Volvo FH 500 Schmitz Cargobull', 'REEFER', 1340, 246, 260, 22000, 33, true,  21.5, array['orhei','chisinau','hincesti','leova','cantemir','cahul'], 'orhei',  'ON_ROUTE'),
  ('d1000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000004', 'CHL 501', 'DAF CF 450',                'RIGID',        720, 248, 250, 10000, 18, false, 15.0, array['cahul','cantemir','leova','hincesti','chisinau'],     'cahul',      'ON_ROUTE'),
  ('d1000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000005', 'BLT 901', 'Scania R500 trailă',        'LOWBED',      1300, 255, 300, 30000,  0, false, 32.0, array['balti','singerei','orhei','chisinau'],                'balti',      'ON_ROUTE'),
  ('d1000000-0000-4000-8000-000000000007', 'd0000000-0000-4000-8000-000000000006', 'SLD 309', 'MAN TGX 18.440',            'CURTAINSIDE', 1360, 245, 270, 24000, 33, false, 18.0, array['soldanesti','orhei','chisinau','anenii_noi'],         'soldanesti', 'ON_ROUTE'),
  ('d1000000-0000-4000-8000-000000000008', 'd0000000-0000-4000-8000-000000000007', 'LVA 881', 'DAF XF 480',                'CURTAINSIDE', 1360, 245, 270, 24000, 33, false, 17.5, null::text[],                                           'leova',      'AVAILABLE'),
  ('d1000000-0000-4000-8000-000000000009', 'd0000000-0000-4000-8000-000000000008', 'ANN 212', 'Iveco S-Way 460',           'CURTAINSIDE', 1360, 245, 270, 24000, 33, false, 17.0, array['anenii_noi','chisinau','orhei','singerei','balti'],   'anenii_noi', 'ON_ROUTE'),
  ('d1000000-0000-4000-8000-000000000010', 'd0000000-0000-4000-8000-000000000009', 'UNG 115', 'Renault D Wide',            'RIGID',        720, 248, 250,  9500, 18, false, 14.0, array['ungheni','calarasi','straseni','chisinau'],          'ungheni',    'ON_ROUTE')
),
routes as (
  select s.*,
         case when s.via is null then null else (
           select ST_MakeLine(d.center::geometry order by v.ord)
           from unnest(s.via) with ordinality as v(district, ord) join public.districts d on d.id = v.district
         ) end as route
  from spec s
)
insert into public.vehicles (id, company_id, plate, make_model, body_type, cargo_length_cm, cargo_width_cm, cargo_height_cm,
                             max_payload_kg, pallet_capacity, has_reefer, price_per_km, gps_protocol, status, is_listed,
                             district_id, position, position_at, speed_kmh,
                             trip_origin_id, trip_destination_id, trip_departure_at, trip_route, trip_distance_km, trip_duration_min)
select r.id::uuid, r.company::uuid, r.plate, r.make_model, r.body, r.l, r.w, r.h, r.payload, r.pallets, r.reefer, r.price,
       'TELTONIKA', r.status, true, r.dist_now,
       coalesce(ST_StartPoint(r.route)::geography, (select center from public.districts where id = r.dist_now)), now(),
       case when r.route is null then 0 else 62 end,
       r.via[1], r.via[array_length(r.via, 1)],
       case when r.via is not null then now() + interval '20 minutes' end, r.route,
       round((ST_Length(r.route::geography) / 1000 * 1.3)::numeric, 1),
       round(ST_Length(r.route::geography) / 1000 * 1.3)::int
from routes r
on conflict (id) do nothing;

-- Flota multimodală: un vagon închiriat (locuri declarate în bloc) și o dronă
-- care deservește Chișinăul și raioanele din jur, în flotele firmelor demo.
insert into public.vehicles (id, company_id, plate, make_model, body_type, cargo_length_cm, cargo_width_cm, cargo_height_cm,
                             max_payload_kg, pallet_capacity, price_per_km, gps_protocol, status, is_listed,
                             ownership, ownership_until, service_district_ids, district_id, position, position_at,
                             occupied_pallets, occupied_weight_kg)
select u.id::uuid, u.company::uuid, u.plate, u.make_model, u.body, u.l, u.w, u.h, u.payload, u.places, u.price,
       'MANUAL', 'AVAILABLE', true, u.ownership, u.until, u.area, u.dist, d.center, now(), u.occ, u.occ_kg
from (values
  ('d1000000-0000-4000-8000-000000000011', 'd0000000-0000-4000-8000-000000000009', '31 53 2458 017-2', 'Vagon acoperit Habbins (CFM)',
   'RAIL_WAGON', 2200, 280, 260, 60000, 50, 9.0, 'RENTED', current_date + 120, '{}'::text[], 'ungheni', 32, 19200),
  ('d1000000-0000-4000-8000-000000000012', 'd0000000-0000-4000-8000-000000000001', 'MDA-UAS-0042', 'DJI FlyCart 30',
   'DRONE', 70, 50, 40, 30, 2, 25.0, 'OWNED', null::date, '{chisinau,ialoveni,anenii_noi,criuleni,straseni}'::text[], 'chisinau', 0, 0)
) as u(id, company, plate, make_model, body, l, w, h, payload, places, price, ownership, until, area, dist, occ, occ_kg)
join public.districts d on d.id = u.dist
on conflict (id) do nothing;

insert into public.vehicle_private (vehicle_id, driver_name, driver_phone)
select id, case body_type when 'DRONE' then 'Operator ' else 'Șofer ' end || plate,
       '+373 69 000 ' || lpad((row_number() over (order by plate))::text, 3, '0')
from public.vehicles
where company_id in (select id from public.companies where is_demo) and body_type <> 'RAIL_WAGON'
on conflict (vehicle_id) do nothing;

-- Paleți EUR 120×80 plasați de la cabină spre uși, 3 pe lățime (2 la dubă).
-- Tren rutier: două caroserii de 770 cm; niciun palet peste cuplaj.
with fill (vehicle_id, n) as (values
  ('d1000000-0000-4000-8000-000000000001'::uuid, 21),
  ('d1000000-0000-4000-8000-000000000002'::uuid, 3),
  ('d1000000-0000-4000-8000-000000000003'::uuid, 18),
  ('d1000000-0000-4000-8000-000000000004'::uuid, 26),
  ('d1000000-0000-4000-8000-000000000005'::uuid, 10),
  ('d1000000-0000-4000-8000-000000000007'::uuid, 22),
  ('d1000000-0000-4000-8000-000000000008'::uuid, 9),
  ('d1000000-0000-4000-8000-000000000009'::uuid, 15),
  ('d1000000-0000-4000-8000-000000000010'::uuid, 6)
),
slots as (
  select f.vehicle_id, v.body_type, v.cargo_length_cm, k,
         case when v.body_type = 'VAN' then 2 else 3 end as across
  from fill f join public.vehicles v on v.id = f.vehicle_id, generate_series(0, f.n - 1) as k
  where not exists (select 1 from public.vehicle_loads l where l.vehicle_id = f.vehicle_id)
)
insert into public.vehicle_loads (vehicle_id, x_cm, y_cm, length_cm, width_cm, format, weight_kg, status, label)
select vehicle_id,
       case when body_type = 'ROAD_TRAIN'
            then ((k / across) / 6) * (cargo_length_cm / 2) + ((k / across) % 6) * 120
            else (k / across) * 120 end,
       (k % across) * 80, 120, 80, 'EUR', 380 + (k * 37) % 320, 'OCCUPIED', null
from slots;

insert into public.freight_requests (id, company_id, origin_district_id, origin_address, origin_point,
                                     destination_district_id, destination_address, destination_point,
                                     pallets, weight_kg, body_type, ready_from, deliver_by, cargo_description, budget_mdl)
select r.id::uuid, r.company::uuid, r.o, r.oa, o.center, r.d, r.da, d.center, r.p, r.kg, r.body,
       now() + interval '2 hours', now() + interval '30 hours', r.descr, r.budget
from (values
  ('d2000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000011', 'chisinau', 'str. Petricani 88', 'balti',  'str. Decebal 101',   6, 3600, null,      'Vin îmbuteliat, cutii pe paleți', 4200),
  ('d2000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000012', 'chisinau', 'bd. Dacia 51',      'balti',  'str. Independenței 4', 4, 2200, null,    'Fructe uscate ambalate',           3000),
  ('d2000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000013', 'orhei',    'str. Eliberării 16','cahul',  'str. Ștefan cel Mare 20', 8, 4100, 'CURTAINSIDE', 'Mobilier demontat', 7800),
  ('d2000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000012', 'chisinau', 'bd. Dacia 51',      'rezina', 'str. 27 August 3',   3, 1500, 'REEFER',  'Legume refrigerate (+4 °C)',       2100)
) as r(id, company, o, oa, d, da, p, kg, body, descr, budget)
join public.districts o on o.id = r.o
join public.districts d on d.id = r.d
on conflict (id) do nothing;

commit;
