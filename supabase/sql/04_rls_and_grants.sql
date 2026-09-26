-- ═══════════════════════════════════════════════════════════════════════════
-- OptiFleet v2 — 04: Row Level Security + drepturi pe coloane
--
-- Model: clientul (cheia publică + sesiunea utilizatorului) poate citi doar ce
-- permit politicile și poate scrie DOAR coloanele listate explicit. Orice
-- tranziție de stare (rezervare, semnare, livrare, KYC) trece prin funcții RPC
-- din 05_business_rpc.sql, care verifică apelantul și scriu jurnalul.
-- ═══════════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- Pornim de la zero: Supabase acordă implicit ALL pe tabelele din public.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

alter table public.districts         enable row level security;
alter table public.companies         enable row level security;
alter table public.profiles          enable row level security;
alter table public.platform_admins   enable row level security;
alter table public.vehicles          enable row level security;
alter table public.vehicle_private   enable row level security;
alter table public.vehicle_devices   enable row level security;
alter table public.vehicle_loads     enable row level security;
alter table public.freight_requests  enable row level security;
alter table public.bookings          enable row level security;
alter table public.booking_messages  enable row level security;
alter table public.delivery_proofs   enable row level security;
alter table public.notifications     enable row level security;
alter table public.audit_log         enable row level security;

grant execute on function public.current_company_id()          to authenticated;
grant execute on function public.is_platform_admin()           to authenticated;
grant execute on function public.is_company_admin()            to authenticated;
grant execute on function public.current_company_is_verified() to authenticated;

-- ─── districts: date publice de referință ─────────────────────────────────
grant select on public.districts to anon, authenticated;
create policy districts_read on public.districts for select to anon, authenticated using (true);

-- ─── companies ────────────────────────────────────────────────────────────
grant select on public.companies to authenticated;
grant update (name, address, phone, district_id, location) on public.companies to authenticated;

create policy companies_read on public.companies for select to authenticated using (
  id = (select public.current_company_id())
  or kyc_status = 'VERIFIED'
  or (select public.is_platform_admin())
);
create policy companies_update_own on public.companies for update to authenticated
  using (id = (select public.current_company_id()) and (select public.is_company_admin()))
  with check (id = (select public.current_company_id()));

-- ─── profiles ─────────────────────────────────────────────────────────────
grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;

create policy profiles_read on public.profiles for select to authenticated using (
  company_id = (select public.current_company_id()) or (select public.is_platform_admin())
);
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ─── platform_admins: fiecare își poate vedea doar propriul rând ──────────
grant select on public.platform_admins to authenticated;
create policy platform_admins_self on public.platform_admins for select to authenticated
  using (user_id = (select auth.uid()));

-- ─── vehicles ─────────────────────────────────────────────────────────────
grant select on public.vehicles to authenticated;
grant insert (company_id, plate, make_model, body_type, cargo_length_cm, cargo_width_cm, cargo_height_cm,
              max_payload_kg, pallet_capacity, has_reefer, price_per_km, gps_device_id, gps_protocol,
              status, is_listed, position, district_id, position_at)
  on public.vehicles to authenticated;
grant update (make_model, body_type, cargo_length_cm, cargo_width_cm, cargo_height_cm, max_payload_kg,
              pallet_capacity, has_reefer, price_per_km, gps_device_id, gps_protocol, status, is_listed,
              position, district_id, speed_kmh, heading, position_at)
  on public.vehicles to authenticated;
grant delete on public.vehicles to authenticated;

-- Vizibil: flota proprie, vehiculele listate ale transportatorilor verificați
-- (bursa), vehiculul unei rezervări active a expeditorului, adminul.
create policy vehicles_read on public.vehicles for select to authenticated using (
  company_id = (select public.current_company_id())
  or (is_listed and company_id in (select c.id from public.companies c where c.kyc_status = 'VERIFIED'))
  or id in (select b.vehicle_id from public.bookings b
            where b.shipper_company_id = (select public.current_company_id())
              and b.status in ('NEGOTIATING', 'AGREED', 'CONTRACTED', 'IN_TRANSIT'))
  or (select public.is_platform_admin())
);
create policy vehicles_insert_own on public.vehicles for insert to authenticated with check (
  company_id = (select public.current_company_id())
  and exists (select 1 from public.companies c where c.id = company_id and c.kind in ('CARRIER', 'BOTH'))
);
create policy vehicles_update_own on public.vehicles for update to authenticated
  using (company_id = (select public.current_company_id()))
  with check (company_id = (select public.current_company_id()));
create policy vehicles_delete_own on public.vehicles for delete to authenticated using (
  company_id = (select public.current_company_id())
  and not exists (select 1 from public.bookings b where b.vehicle_id = vehicles.id
                  and b.status in ('NEGOTIATING', 'AGREED', 'CONTRACTED', 'IN_TRANSIT'))
);

-- ─── vehicle_private: proprietar + contrapartea unui contract activ ───────
grant select on public.vehicle_private to authenticated;
grant insert (vehicle_id, driver_name, driver_phone), update (driver_name, driver_phone)
  on public.vehicle_private to authenticated;

create policy vehicle_private_read on public.vehicle_private for select to authenticated using (
  exists (select 1 from public.vehicles v where v.id = vehicle_id and v.company_id = (select public.current_company_id()))
  or exists (select 1 from public.bookings b where b.vehicle_id = vehicle_private.vehicle_id
             and b.shipper_company_id = (select public.current_company_id())
             and b.status in ('CONTRACTED', 'IN_TRANSIT'))
);
create policy vehicle_private_write on public.vehicle_private for insert to authenticated with check (
  exists (select 1 from public.vehicles v where v.id = vehicle_id and v.company_id = (select public.current_company_id()))
);
create policy vehicle_private_update on public.vehicle_private for update to authenticated using (
  exists (select 1 from public.vehicles v where v.id = vehicle_id and v.company_id = (select public.current_company_id()))
);

-- vehicle_devices: fără politici → inaccesibil din client (doar prin RPC).

-- ─── vehicle_loads: citire ca vehiculul; scriere doar prin save_vehicle_layout ─
grant select on public.vehicle_loads to authenticated;
create policy vehicle_loads_read on public.vehicle_loads for select to authenticated using (
  exists (select 1 from public.vehicles v where v.id = vehicle_id)
);

-- ─── freight_requests ─────────────────────────────────────────────────────
grant select on public.freight_requests to authenticated;
grant insert (company_id, origin_district_id, origin_address, origin_point, destination_district_id,
              destination_address, destination_point, pallets, pallet_format, weight_kg, body_type,
              needs_reefer, vehicles_needed, ready_from, deliver_by, cargo_description, budget_mdl)
  on public.freight_requests to authenticated;
grant update (origin_address, destination_address, pallets, pallet_format, weight_kg, body_type,
              needs_reefer, vehicles_needed, ready_from, deliver_by, cargo_description, budget_mdl)
  on public.freight_requests to authenticated;

create policy freight_read on public.freight_requests for select to authenticated using (
  company_id = (select public.current_company_id())
  or (status = 'OPEN' and (select public.current_company_is_verified())
      and exists (select 1 from public.companies c where c.id = (select public.current_company_id())
                  and c.kind in ('CARRIER', 'BOTH')))
  or exists (select 1 from public.bookings b where b.request_id = freight_requests.id
             and b.carrier_company_id = (select public.current_company_id()))
  or (select public.is_platform_admin())
);
create policy freight_insert_own on public.freight_requests for insert to authenticated with check (
  company_id = (select public.current_company_id())
);
create policy freight_update_own_open on public.freight_requests for update to authenticated
  using (company_id = (select public.current_company_id()) and status = 'OPEN')
  with check (company_id = (select public.current_company_id()));

-- ─── bookings: doar părțile; scriere doar prin RPC ────────────────────────
grant select on public.bookings to authenticated;
create policy bookings_parties on public.bookings for select to authenticated using (
  shipper_company_id = (select public.current_company_id())
  or carrier_company_id = (select public.current_company_id())
  or (select public.is_platform_admin())
);

-- ─── booking_messages ─────────────────────────────────────────────────────
grant select on public.booking_messages to authenticated;
grant insert (booking_id, sender_company_id, body, price_mdl) on public.booking_messages to authenticated;

create policy booking_messages_read on public.booking_messages for select to authenticated using (
  exists (select 1 from public.bookings b where b.id = booking_id)
);
create policy booking_messages_insert on public.booking_messages for insert to authenticated with check (
  sender_company_id = (select public.current_company_id())
  and sender_user_id = (select auth.uid())
  and exists (
    select 1 from public.bookings b
    where b.id = booking_id
      and (b.shipper_company_id = sender_company_id or b.carrier_company_id = sender_company_id)
      and b.status in ('NEGOTIATING', 'AGREED', 'CONTRACTED', 'IN_TRANSIT')
      and (price_mdl is null or b.status in ('NEGOTIATING', 'AGREED'))
  )
);

-- ─── delivery_proofs ──────────────────────────────────────────────────────
grant select on public.delivery_proofs to authenticated;
create policy delivery_proofs_read on public.delivery_proofs for select to authenticated using (
  exists (select 1 from public.bookings b where b.id = booking_id)
);

-- ─── notifications ────────────────────────────────────────────────────────
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy notifications_own on public.notifications for select to authenticated
  using (company_id = (select public.current_company_id()));
create policy notifications_mark_read on public.notifications for update to authenticated
  using (company_id = (select public.current_company_id()))
  with check (company_id = (select public.current_company_id()));

-- ─── audit_log: citire pentru compania proprie / admin; zero scriere ──────
grant select on public.audit_log to authenticated;
create policy audit_read on public.audit_log for select to authenticated using (
  company_id = (select public.current_company_id()) or (select public.is_platform_admin())
);
