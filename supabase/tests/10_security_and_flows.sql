-- ═══════════════════════════════════════════════════════════════════════════
-- Teste end-to-end pe baza de date: RLS, drepturi pe coloane, K4, K7, K8–K11.
-- Rulează: supabase/tests/run.sh (container supabase/postgres local).
-- ═══════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
\set S  '''11111111-1111-4111-8111-111111111111'''
\set S2 '''22222222-2222-4222-8222-222222222222'''
\set C  '''33333333-3333-4333-8333-333333333333'''
\set O  '''44444444-4444-4444-8444-444444444444'''
\set A  '''55555555-5555-4555-8555-555555555555'''

-- ─── Înregistrare prin trigger (K1) ───────────────────────────────────────
insert into auth.users (id, email, raw_user_meta_data) values
  (:S,  's@test.md',  '{"full_name":"Ana Expeditor","company_name":"Expeditor Unu","legal_form":"SRL","idno":"2000000000011","company_kind":"SHIPPER","district_id":"chisinau"}'),
  (:S2, 's2@test.md', '{"full_name":"Dan Expeditor","company_name":"Expeditor Doi","legal_form":"II","idno":"2000000000022","company_kind":"SHIPPER","district_id":"orhei"}'),
  (:C,  'c@test.md',  '{"full_name":"Ion Transport","company_name":"Carausul Test","legal_form":"SRL","idno":"2000000000033","company_kind":"CARRIER","district_id":"chisinau"}'),
  (:O,  'o@test.md',  '{"full_name":"Alt Transport","company_name":"Carausul Neverificat","legal_form":"SRL","idno":"2000000000044","company_kind":"CARRIER","district_id":"balti"}'),
  (:A,  'a@test.md',  '{}');
insert into public.platform_admins (user_id) values (:A);

select test.expect_error($$insert into auth.users (id, email, raw_user_meta_data) values
  ('66666666-6666-4666-8666-666666666666', 'bad@test.md', '{"company_name":"Rau","idno":"123","company_kind":"SHIPPER"}')$$,
  'companies_idno_check');

do $$ begin
  perform test.eq((select count(*) from public.companies where not is_demo)::int, 4, 'înregistrare: 4 companii create din metadate');
  perform test.eq((select company_id is null from public.profiles where id = '55555555-5555-4555-8555-555555555555') , null, 'admin fără companie (niciun profil)');
end $$;

-- ─── Expeditor neverificat ────────────────────────────────────────────────
set role authenticated;
select test.act_as(:S);
do $$ begin
  perform test.eq((select count(*) from public.companies where name = 'Carausul Neverificat')::int, 0, 'RLS: nu vede firme neverificate ale altora');
  perform test.eq((select count(*) from public.vehicles)::int, 10, 'bursa: vede cele 10 vehicule demo listate');
  perform test.eq((select count(*) from public.vehicle_private)::int, 0, 'RLS: nu vede datele șoferilor');
  perform test.eq((select count(*) from public.vehicles_map where lat is not null)::int, 10, 'view vehicles_map: coordonate pentru hartă');
  perform test.eq((public.vehicle_route('d1000000-0000-4000-8000-000000000001') ->> 'type'), 'LineString', 'vehicle_route: GeoJSON');
  perform test.eq((select count(*) from public.freight_requests)::int, 0, 'RLS: expeditorul nu vede cererile altor expeditori');
end $$;
select test.expect_error($$select * from public.vehicle_devices$$, 'permission denied');
select test.expect_error($$update public.companies set kyc_status = 'VERIFIED'$$, 'permission denied');
select test.expect_error($$update public.vehicles set booked_pallets = 0$$, 'permission denied');
select test.expect_error($$insert into public.audit_log (action, entity) values ('X', 'y')$$, 'permission denied');
select test.expect_error($$insert into public.vehicles (company_id, plate, make_model, body_type, cargo_length_cm, cargo_width_cm, cargo_height_cm, max_payload_kg, pallet_capacity)
  values (public.current_company_id(), 'SHP 001', 'Test', 'VAN', 420, 178, 190, 1300, 5)$$, 'row-level security');
select test.expect_error($$select public.propose_booking('d1000000-0000-4000-8000-000000000001', 2, 800, 'chisinau', 'rezina')$$, 'verificată');
select test.expect_error($$select public.review_company(public.current_company_id(), 'VERIFIED')$$, 'administratorii');

-- ─── Admin verifică firmele (KYC) ─────────────────────────────────────────
select test.act_as(:A);
select public.review_company(c.id, 'VERIFIED', 'ok') from public.companies c where c.name in ('Expeditor Unu', 'Expeditor Doi', 'Carausul Test');
select test.expect_error($$select public.review_company(c.id, 'REJECTED') from public.companies c where c.name = 'Carausul Neverificat'$$, 'motivul');

-- ─── Transportator: vehicul + plan de încărcare (K6/K7) ───────────────────
select test.act_as(:C);
insert into public.vehicles (company_id, plate, make_model, body_type, cargo_length_cm, cargo_width_cm, cargo_height_cm, max_payload_kg, pallet_capacity, price_per_km, district_id)
values (public.current_company_id(), 'TST 100', 'Mercedes Actros', 'CURTAINSIDE', 1360, 245, 270, 24000, 33, 20, 'chisinau');

select test.expect_error($$select public.save_vehicle_layout((select id from public.vehicles where plate = 'TST 100'),
  '[{"x_cm":0,"y_cm":0,"length_cm":120,"width_cm":80,"format":"EUR","weight_kg":500},
    {"x_cm":60,"y_cm":40,"length_cm":120,"width_cm":80,"format":"EUR","weight_kg":500}]')$$, 'se suprapun');
select test.expect_error($$select public.save_vehicle_layout((select id from public.vehicles where plate = 'TST 100'),
  '[{"x_cm":1300,"y_cm":0,"length_cm":120,"width_cm":80,"format":"EUR","weight_kg":500}]')$$, 'iese din caroserie');
select public.save_vehicle_layout(
  (select id from public.vehicles where plate = 'TST 100'),
  (select jsonb_agg(jsonb_build_object('x_cm', (k / 3) * 120, 'y_cm', (k % 3) * 80, 'length_cm', 120, 'width_cm', 80,
                                       'format', 'EUR', 'weight_kg', 600))
   from generate_series(0, 29) k));
do $$ begin
  perform test.eq((select occupied_pallets from public.vehicles where plate = 'TST 100'), 30, 'K7: 30 paleți plasați');
  perform test.eq((select free_pallets from public.vehicles where plate = 'TST 100'), 3, 'K7: 3 locuri libere');
  perform test.eq((select occupied_weight_kg from public.vehicles where plate = 'TST 100'), 18000, 'K7: greutatea totală = suma paleților');
end $$;
select test.expect_error($$select public.save_vehicle_layout((select id from public.vehicles where plate = 'CAN 001'), '[]')$$, 'fără drept');
select public.set_vehicle_trip((select id from public.vehicles where plate = 'TST 100'), 'chisinau', 'soroca', now() + interval '1 hour');

-- Transportatorul vede bursa de cereri (e verificat)
do $$ begin
  perform test.eq((select count(*) from public.freight_requests where status = 'OPEN')::int, 4, 'bursă: transportatorul verificat vede cererile deschise');
  perform test.eq((select count(*) from public.freight_requests_geo where origin_lat is not null)::int, 4, 'view freight_requests_geo: coordonate');
end $$;

-- ─── Căutare cu tranzit (K4) ──────────────────────────────────────────────
select test.act_as(:S);
do $$ begin
  perform test.eq((select match_type from public.search_trips('chisinau', 'rezina') where plate = 'CAN 001'), 'DIRECT', 'K4: Chișinău→Rezina găsește cursa directă');
  perform test.eq((select match_type from public.search_trips('chisinau', 'soldanesti') where plate = 'CAN 001'), 'TRANSIT', 'K4: Chișinău→Șoldănești găsește camionul în tranzit');
  perform test.eq((select match_type from public.search_trips('chisinau', 'orhei') where plate = 'ANN 212'), 'TRANSIT', 'K4: mașina din Anenii Noi care trece prin Chișinău');
  perform test.eq((select count(*) from public.search_trips('chisinau', 'orhei') where plate = 'BLT 402')::int, 0, 'K4: sensul opus e exclus');
  perform test.eq((select count(*) from public.search_trips('chisinau', 'rezina', 12) where plate = 'CAN 001')::int, 0, 'K4: 12 liberi, cerut >12 → exclus (strict mai mare)');
  perform test.eq((select count(*) from public.search_trips('chisinau', 'rezina', 11) where plate = 'CAN 001')::int, 1, 'K4: 12 liberi, cerut >11 → inclus');
  perform test.eq((select match_type from public.search_trips('leova', 'chisinau') where plate = 'LVA 881'), 'AT_ORIGIN', 'K4: camion liber aflat chiar în raionul de plecare');
  perform test.eq((select count(*) from public.search_trips('chisinau', 'rezina', 0, false) where match_type <> 'DIRECT')::int, 0, 'K4: fără „tranzit” doar curse directe');
  perform test.eq((select eta_origin < eta_destination from public.search_trips('chisinau', 'soldanesti') where plate = 'CAN 001'), true, 'K4: ora de trecere A < B');
end $$;

-- ─── Negociere + contract Calea A (K8, K9, K12) ───────────────────────────
select public.propose_booking((select id from public.vehicles where plate = 'TST 100'), 2, 1200, 'chisinau', 'soroca', null, null, null, 'Am 2 paleți de vin');
select test.act_as(:S2);
select public.propose_booking((select id from public.vehicles where plate = 'TST 100'), 2, 1200, 'chisinau', 'soroca');

reset role;
select set_config('test.booking', (select id::text from public.bookings order by created_at limit 1), false);
set role authenticated;
select test.act_as(:O);
do $$ begin
  perform test.eq((select count(*) from public.bookings)::int, 0, 'RLS: firmă terță nu vede rezervările');
  perform test.eq((select count(*) from public.booking_messages)::int, 0, 'RLS: firmă terță nu vede mesajele');
end $$;
select test.expect_error($$insert into public.booking_messages (booking_id, sender_company_id, body)
  values (current_setting('test.booking')::uuid, public.current_company_id(), 'spam')$$, 'row-level security');

select test.act_as(:C);
do $$ begin
  perform test.eq((select count(*) from public.notifications where kind in ('BOOKING_MESSAGE', 'BOOKING_PROPOSED'))::int, 2, 'K8: transportatorul a primit 2 notificări');
  perform test.eq((select price_mdl is not null from public.bookings order by created_at limit 1), true, 'K12: preț propus automat din preț/km');
end $$;
insert into public.booking_messages (booking_id, sender_company_id, body, price_mdl)
select id, public.current_company_id(), 'Pot la 1500 MDL', 1500 from public.bookings
where shipper_company_id = (select id from public.companies where name = 'Expeditor Unu');
select test.expect_error($$select public.accept_price(id) from public.bookings
  where shipper_company_id = (select id from public.companies where name = 'Expeditor Unu')$$, 'cealaltă parte');

select test.act_as(:S);
select public.accept_price(id) from public.bookings;
select public.choose_contract_path(id, 'PLATFORM') from public.bookings;
do $$ begin
  perform test.eq((select contract_hash = encode(extensions.digest(contract_snapshot::text, 'sha256'), 'hex') from public.bookings), true, 'K9: hash SHA-256 real al contractului');
  perform test.eq((select contract_snapshot -> 'carrier' ->> 'idno' from public.bookings), '2000000000033', 'K12: date legale completate automat din profil');
end $$;
select public.sign_booking(id) from public.bookings;

-- S2: prețul auto-propus de expeditor e acceptat de transportator; Calea B
select test.act_as(:C);
select public.accept_price(id) from public.bookings
where shipper_company_id = (select id from public.companies where name = 'Expeditor Doi');

select test.act_as(:S2);
select test.expect_error($$select public.choose_contract_path(id, 'DIRECT') from public.bookings$$, 'NU își asumă');
select public.choose_contract_path(id, 'DIRECT', true) from public.bookings;
select public.sign_booking(id, true) from public.bookings;

-- Transportatorul semnează ambele: primul contract rezervă 2 din 3 locuri,
-- al doilea (2 paleți) trebuie respins atomic — K10.
select test.act_as(:C);
select test.eq(public.sign_booking(b.id), 'CONTRACTED', 'K9 Calea A: ambele semnături → contract activ')
from public.bookings b where b.path = 'PLATFORM';
select test.expect_error($$select public.sign_booking(id, false) from public.bookings where path = 'DIRECT'$$, 'NU își asumă');
select test.expect_error($$select public.sign_booking(id, true) from public.bookings where path = 'DIRECT'$$, 'doar 1 paleți liberi');
do $$ begin
  perform test.eq((select free_pallets from public.vehicles where plate = 'TST 100'), 1, 'K10: capacitate actualizată după contract');
  perform test.eq((select status from public.bookings where path = 'DIRECT'), 'AGREED', 'K10: al doilea contract nu a trecut');
end $$;

-- ─── Livrare cu dovadă foto (K11) ─────────────────────────────────────────
select public.start_transit(id) from public.bookings where status = 'CONTRACTED';
select test.expect_error($$select public.confirm_delivery(id) from public.bookings where status = 'IN_TRANSIT'$$, 'fotografia');

reset role;
insert into storage.objects (bucket_id, name, owner)
select 'delivery-proofs', id || '/0b7e8f2a-1c3d-4e5f-8a9b-0c1d2e3f4a5b.jpg', '33333333-3333-4333-8333-333333333333'
from public.bookings where status = 'IN_TRANSIT';
set role authenticated;

select test.act_as(:S);
select test.expect_error($$select public.record_delivery_proof(id, id || '/0b7e8f2a-1c3d-4e5f-8a9b-0c1d2e3f4a5b.jpg', 47.1, 28.9, now()) from public.bookings where status = 'IN_TRANSIT'$$, 'doar transportatorul');
do $$ begin
  perform test.eq((select count(*) from storage.objects where bucket_id = 'delivery-proofs')::int, 1, 'K11: expeditorul vede poza');
end $$;
select test.act_as(:O);
do $$ begin
  perform test.eq((select count(*) from storage.objects where bucket_id = 'delivery-proofs')::int, 0, 'K11: firmă terță NU vede poza');
end $$;

select test.act_as(:C);
select public.record_delivery_proof(id, id || '/0b7e8f2a-1c3d-4e5f-8a9b-0c1d2e3f4a5b.jpg', 48.15, 28.29, now()) from public.bookings where status = 'IN_TRANSIT';
select test.eq(public.confirm_delivery(id), 'IN_TRANSIT', 'K9: o singură confirmare nu închide Calea A') from public.bookings where status = 'IN_TRANSIT';
select test.act_as(:S);
select test.eq(public.confirm_delivery(id), 'DELIVERED', 'K9: a doua confirmare închide livrarea') from public.bookings where status = 'IN_TRANSIT';
do $$ begin
  perform test.eq((select booked_pallets from public.vehicles where plate = 'TST 100'), 0, 'K10: capacitatea eliberată după livrare');
  perform test.eq((select count(*) from public.audit_log where entity = 'booking')::int >= 5, true, 'jurnal: evenimentele rezervării sunt înregistrate');
end $$;
select test.expect_error($$update public.audit_log set action = 'X'$$, 'permission denied');
select test.expect_error($$delete from public.audit_log$$, 'permission denied');

-- ─── GPS (token de dispozitiv) ────────────────────────────────────────────
select test.act_as(:C);
select set_config('test.token', public.issue_device_token((select id from public.vehicles where plate = 'TST 100')), false);
reset role;
set role anon;
select test.act_as(null);
do $$ begin
  perform test.eq(public.ingest_position(repeat('0', 64), 47.0, 28.8), false, 'GPS: token greșit respins');
  perform test.eq(public.ingest_position(current_setting('test.token'), 47.05, 28.86, 55, 90), true, 'GPS: token valid acceptat');
  perform test.eq(public.ingest_position(current_setting('test.token'), 47.06, 28.87), false, 'GPS: limită 1 poziție / 5 s');
end $$;
select test.expect_error($$select * from public.vehicles$$, 'permission denied');
reset role;
do $$ begin
  perform test.eq((select district_id from public.vehicles where plate = 'TST 100'), 'chisinau', 'GPS: raionul se deduce din poziție');
end $$;

\echo '══ TOATE TESTELE AU TRECUT ══'
