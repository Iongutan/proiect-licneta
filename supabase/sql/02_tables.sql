-- ═══════════════════════════════════════════════════════════════════════════
-- OptiFleet v2 — 02: tabele
-- Coordonatele sunt geography(Point, 4326) (metri reali); rutele planificate
-- sunt geometry(LineString, 4326) pentru ST_LineLocatePoint (ordinea pe traseu).
-- ═══════════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- ─── Referință: raioane / municipii ───────────────────────────────────────
create table public.districts (
  id      text primary key check (id ~ '^[a-z_]{2,40}$'),
  name    text not null check (char_length(name) between 2 and 60),
  kind    text not null check (kind in ('MUNICIPIU', 'RAION', 'UTA', 'STANGA_NISTRULUI')),
  region  text not null check (region in ('NORD', 'CENTRU', 'SUD')),
  center  geography(Point, 4326) not null
);

-- ─── Companii (tenant) ────────────────────────────────────────────────────
create table public.companies (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(btrim(name)) between 2 and 160),
  legal_form   text not null check (legal_form in ('SRL', 'II', 'SA', 'GT', 'ALTA')),
  idno         text not null unique check (idno ~ '^[0-9]{13}$'),
  kind         text not null check (kind in ('SHIPPER', 'CARRIER', 'BOTH')),
  district_id  text references public.districts (id),
  address      text check (char_length(address) <= 300),
  location     geography(Point, 4326),
  phone        text check (phone ~ '^\+?[0-9 ()-]{6,20}$'),
  kyc_status   text not null default 'PENDING' check (kyc_status in ('PENDING', 'VERIFIED', 'REJECTED')),
  kyc_note     text check (char_length(kyc_note) <= 500),
  verified_at  timestamptz,
  is_demo      boolean not null default false,
  created_at   timestamptz not null default now()
);
create index companies_kyc_idx on public.companies (kyc_status);

-- ─── Utilizatori ──────────────────────────────────────────────────────────
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  company_id    uuid not null references public.companies (id) on delete cascade,
  full_name     text check (char_length(full_name) <= 120),
  company_role  text not null default 'ADMIN' check (company_role in ('ADMIN', 'MEMBER', 'DRIVER')),
  created_at    timestamptz not null default now()
);
create index profiles_company_idx on public.profiles (company_id);

-- Administratorii platformei (verificare KYC, jurnal). Se adaugă doar din SQL Editor.
create table public.platform_admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- ─── Unități de transport (flota firmei) ─────────────────────────────────
-- Un singur tabel pentru orice tip: camion, vagon de tren, dronă. Tipul
-- (body_type) decide limitele fizice și cum se declară locurile ocupate:
-- plan de podea (K7) la rutiere, număr simplu la vagon și dronă.
-- „plate” = identificatorul unității: nr. de înmatriculare, nr. vagon, serie dronă.
-- „pallet_capacity” = locuri: paleți EUR, respectiv compartimente la dronă.
create table public.vehicles (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies (id) on delete cascade,
  plate               text not null unique check (plate ~ '^[A-Z0-9][A-Z0-9 -]{2,19}$'),
  make_model          text not null check (char_length(btrim(make_model)) between 2 and 80),
  body_type           text not null check (body_type in ('VAN', 'RIGID', 'CURTAINSIDE', 'REEFER', 'ROAD_TRAIN', 'LOWBED',
                                                         'RAIL_WAGON', 'DRONE')),
  transport_mode      text generated always as (
                        case body_type when 'RAIL_WAGON' then 'RAIL' when 'DRONE' then 'AIR' else 'ROAD' end
                      ) stored,
  cargo_length_cm     integer not null check (cargo_length_cm between 10 and 2800),
  cargo_width_cm      integer not null check (cargo_width_cm between 10 and 320),
  cargo_height_cm     integer not null check (cargo_height_cm between 5 and 350),
  max_payload_kg      integer not null check (max_payload_kg between 1 and 90000),
  pallet_capacity     integer not null check (pallet_capacity between 0 and 80),
  has_reefer          boolean not null default false,
  ownership           text not null default 'OWNED' check (ownership in ('OWNED', 'LEASED', 'RENTED')),
  ownership_until     date,
  -- Raioanele deservite (obligatoriu la dronă; validate de trigger contra districts).
  service_district_ids text[] not null default '{}' check (cardinality(service_district_ids) <= 40),
  price_per_km        numeric(8, 2) check (price_per_km between 0 and 500),
  gps_device_id       text check (char_length(gps_device_id) <= 64),
  gps_protocol        text not null default 'MANUAL' check (gps_protocol in ('TELTONIKA', 'CONCOX', 'WIALON', 'MANUAL')),
  status              text not null default 'AVAILABLE' check (status in ('AVAILABLE', 'ON_ROUTE', 'MAINTENANCE', 'OFFLINE')),
  is_listed           boolean not null default true,

  -- Poziție live
  position            geography(Point, 4326),
  district_id         text references public.districts (id),
  speed_kmh           numeric(5, 1) check (speed_kmh between 0 and 200),
  heading             smallint check (heading between 0 and 359),
  position_at         timestamptz,

  -- Cursă planificată (pentru potrivirea de tranzit, K4)
  trip_origin_id      text references public.districts (id),
  trip_destination_id text references public.districts (id),
  trip_departure_at   timestamptz,
  trip_route          geometry(LineString, 4326),
  trip_distance_km    numeric(7, 1) check (trip_distance_km >= 0),
  trip_duration_min   integer check (trip_duration_min >= 0),

  -- Întreținute doar de triggere / RPC (nu pot fi scrise de client)
  occupied_pallets    integer not null default 0 check (occupied_pallets >= 0),
  occupied_weight_kg  integer not null default 0 check (occupied_weight_kg >= 0),
  booked_pallets      integer not null default 0 check (booked_pallets >= 0),
  booked_weight_kg    integer not null default 0 check (booked_weight_kg >= 0),
  free_pallets        integer generated always as (pallet_capacity - occupied_pallets - booked_pallets) stored,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint vehicles_capacity_not_exceeded check (occupied_pallets + booked_pallets <= pallet_capacity),
  constraint vehicles_payload_not_exceeded  check (occupied_weight_kg + booked_weight_kg <= max_payload_kg),
  constraint vehicles_trip_distinct         check (trip_origin_id is null or trip_origin_id <> trip_destination_id),
  constraint vehicles_lowbed_no_pallets     check (body_type <> 'LOWBED' or pallet_capacity = 0),
  constraint vehicles_limits_by_type        check (case body_type
    when 'DRONE' then cargo_length_cm between 10 and 200 and cargo_width_cm between 10 and 200
                  and cargo_height_cm between 5 and 150 and max_payload_kg between 1 and 500 and pallet_capacity between 1 and 20
    when 'RAIL_WAGON' then cargo_length_cm between 1000 and 2800 and cargo_width_cm between 200 and 320
                  and cargo_height_cm between 150 and 350 and max_payload_kg between 5000 and 90000 and pallet_capacity between 0 and 80
    else plate ~ '^[A-Z0-9][A-Z0-9 -]{2,11}$'
                  and cargo_length_cm between 150 and 2000 and cargo_width_cm between 100 and 260
                  and cargo_height_cm between 80 and 320 and max_payload_kg between 300 and 44000 and pallet_capacity between 0 and 66
  end),
  constraint vehicles_drone_has_area        check (body_type <> 'DRONE' or cardinality(service_district_ids) >= 1),
  constraint vehicles_owned_no_until        check (ownership <> 'OWNED' or ownership_until is null)
);
create index vehicles_company_idx   on public.vehicles (company_id);
create index vehicles_position_gix  on public.vehicles using gist (position);
create index vehicles_route_gix     on public.vehicles using gist (trip_route);
create index vehicles_market_idx    on public.vehicles (district_id) where is_listed and status in ('AVAILABLE', 'ON_ROUTE');

-- Date de contact ale șoferului — separate, vizibile doar proprietarului și
-- contrapărții unui contract activ.
create table public.vehicle_private (
  vehicle_id    uuid primary key references public.vehicles (id) on delete cascade,
  driver_name   text check (char_length(driver_name) <= 120),
  driver_phone  text check (driver_phone ~ '^\+?[0-9 ()-]{6,20}$')
);

-- Token de dispozitiv GPS (stocat doar ca hash SHA-256).
create table public.vehicle_devices (
  vehicle_id   uuid primary key references public.vehicles (id) on delete cascade,
  token_hash   text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at   timestamptz not null default now()
);

-- ─── Cereri de transport (expeditori fără mașini) ─────────────────────────
create table public.freight_requests (
  id                       uuid primary key default gen_random_uuid(),
  company_id               uuid not null references public.companies (id) on delete cascade,
  created_by               uuid default auth.uid() references auth.users (id) on delete set null,
  origin_district_id       text not null references public.districts (id),
  origin_address           text check (char_length(origin_address) <= 300),
  origin_point             geography(Point, 4326) not null,
  destination_district_id  text not null references public.districts (id),
  destination_address      text check (char_length(destination_address) <= 300),
  destination_point        geography(Point, 4326) not null,
  pallets                  integer not null check (pallets between 1 and 66),
  pallet_format            text not null default 'EUR' check (pallet_format in ('EUR', 'INDUSTRIAL', 'MIXED')),
  weight_kg                integer not null check (weight_kg between 1 and 44000),
  body_type                text check (body_type in ('VAN', 'RIGID', 'CURTAINSIDE', 'REEFER', 'ROAD_TRAIN', 'LOWBED',
                                                    'RAIL_WAGON', 'DRONE')),
  needs_reefer             boolean not null default false,
  vehicles_needed          smallint not null default 1 check (vehicles_needed between 1 and 20),
  ready_from               timestamptz not null,
  deliver_by               timestamptz not null,
  cargo_description        text check (char_length(cargo_description) <= 500),
  budget_mdl               numeric(10, 2) check (budget_mdl >= 0),
  status                   text not null default 'OPEN' check (status in ('OPEN', 'BOOKED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED')),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint freight_window_valid check (deliver_by > ready_from)
);
create index freight_company_idx on public.freight_requests (company_id, created_at desc);
create index freight_open_idx    on public.freight_requests (ready_from) where status = 'OPEN';
create index freight_origin_gix  on public.freight_requests using gist (origin_point);

-- ─── Rezervări / negociere / contract ─────────────────────────────────────
create table public.bookings (
  id                              uuid primary key default gen_random_uuid(),
  vehicle_id                      uuid not null references public.vehicles (id),
  request_id                      uuid references public.freight_requests (id) on delete set null,
  shipper_company_id              uuid not null references public.companies (id),
  carrier_company_id              uuid not null references public.companies (id),
  initiated_by                    text not null check (initiated_by in ('SHIPPER', 'CARRIER')),
  pallets                         integer not null check (pallets between 1 and 66),
  weight_kg                       integer not null check (weight_kg between 1 and 44000),
  pickup_district_id              text not null references public.districts (id),
  dropoff_district_id             text not null references public.districts (id),
  pickup_at                       timestamptz,
  price_mdl                       numeric(10, 2) check (price_mdl >= 0),
  price_proposed_by               text check (price_proposed_by in ('SHIPPER', 'CARRIER')),
  status                          text not null default 'NEGOTIATING'
                                  check (status in ('NEGOTIATING', 'AGREED', 'CONTRACTED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED', 'REJECTED')),
  path                            text check (path in ('PLATFORM', 'DIRECT')),
  disclaimer_accepted_at          timestamptz,
  disclaimer_accepted_by          uuid references auth.users (id),
  contract_snapshot               jsonb,
  contract_hash                   text check (contract_hash ~ '^[0-9a-f]{64}$'),
  shipper_signed_at               timestamptz,
  shipper_signed_by               uuid references auth.users (id),
  carrier_signed_at               timestamptz,
  carrier_signed_by               uuid references auth.users (id),
  capacity_reserved               boolean not null default false,
  shipper_delivery_confirmed_at   timestamptz,
  carrier_delivery_confirmed_at   timestamptz,
  delivered_at                    timestamptz,
  payment_terms_days              smallint not null default 14 check (payment_terms_days between 0 and 90),
  paid_confirmed_at               timestamptz,
  paid_confirmed_by               uuid references auth.users (id),
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now(),
  constraint bookings_parties_distinct check (shipper_company_id <> carrier_company_id),
  constraint bookings_direct_needs_disclaimer check (path is distinct from 'DIRECT' or disclaimer_accepted_at is not null)
);
create index bookings_vehicle_idx on public.bookings (vehicle_id);
create index bookings_shipper_idx on public.bookings (shipper_company_id, created_at desc);
create index bookings_carrier_idx on public.bookings (carrier_company_id, created_at desc);

create table public.booking_messages (
  id                 uuid primary key default gen_random_uuid(),
  booking_id         uuid not null references public.bookings (id) on delete cascade,
  sender_company_id  uuid not null references public.companies (id),
  sender_user_id     uuid not null default auth.uid() references auth.users (id),
  body               text not null check (char_length(btrim(body)) between 1 and 1000),
  price_mdl          numeric(10, 2) check (price_mdl >= 0),
  created_at         timestamptz not null default now()
);
create index booking_messages_booking_idx on public.booking_messages (booking_id, created_at);

-- Paleți plasați pe podeaua vehiculului (vedere de sus, K7).
-- x = de-a lungul caroseriei (de la cabină), y = transversal.
create table public.vehicle_loads (
  id          uuid primary key default gen_random_uuid(),
  vehicle_id  uuid not null references public.vehicles (id) on delete cascade,
  x_cm        integer not null check (x_cm >= 0),
  y_cm        integer not null check (y_cm >= 0),
  length_cm   integer not null check (length_cm between 40 and 400),
  width_cm    integer not null check (width_cm between 40 and 260),
  format      text not null check (format in ('EUR', 'INDUSTRIAL', 'CUSTOM')),
  weight_kg   integer not null check (weight_kg between 1 and 2500),
  status      text not null check (status in ('OCCUPIED', 'RESERVED')),
  booking_id  uuid references public.bookings (id) on delete cascade,
  label       text check (char_length(label) <= 60),
  created_at  timestamptz not null default now(),
  constraint vehicle_loads_reserved_has_booking check ((status = 'RESERVED') = (booking_id is not null))
);
create index vehicle_loads_vehicle_idx on public.vehicle_loads (vehicle_id);

create table public.delivery_proofs (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid not null references public.bookings (id) on delete cascade,
  storage_path  text not null unique check (char_length(storage_path) <= 300),
  lat           double precision check (lat between -90 and 90),
  lon           double precision check (lon between -180 and 180),
  taken_at      timestamptz not null,
  uploaded_by   uuid not null references auth.users (id),
  created_at    timestamptz not null default now()
);
create index delivery_proofs_booking_idx on public.delivery_proofs (booking_id);

-- ─── Notificări și jurnal ─────────────────────────────────────────────────
create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  kind        text not null check (char_length(kind) <= 40),
  title       text not null check (char_length(title) <= 160),
  body        text check (char_length(body) <= 500),
  link        text check (link ~ '^/[A-Za-z0-9/_?=&.-]*$'),
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_company_idx on public.notifications (company_id, created_at desc);

-- Append-only: nimeni nu are UPDATE/DELETE, inserarea doar prin log_audit().
create table public.audit_log (
  id          bigint generated always as identity primary key,
  company_id  uuid references public.companies (id) on delete set null,
  actor_id    uuid,
  action      text not null check (char_length(action) <= 60),
  entity      text not null check (char_length(entity) <= 40),
  entity_id   uuid,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index audit_company_idx on public.audit_log (company_id, created_at desc);
create index audit_entity_idx  on public.audit_log (entity, entity_id);
