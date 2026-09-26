-- ═══════════════════════════════════════════════════════════════════════════
-- OptiFleet v2 — 03: funcții de identitate, jurnal, notificări, triggere
--
-- Regulă pentru toate funcțiile SECURITY DEFINER: search_path fix
-- (public, extensions, pg_temp) + verificarea explicită a apelantului.
-- ═══════════════════════════════════════════════════════════════════════════

set search_path = public, extensions;

-- ─── Identitate ───────────────────────────────────────────────────────────
-- Rolul/compania se citesc din profiles, NU din claim-ul JWT `role`
-- (Supabase îl folosește ca rol Postgres).

create function public.current_company_id() returns uuid
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select company_id from public.profiles where id = auth.uid()
$$;

create function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid())
$$;

create function public.is_company_admin() returns boolean
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select exists (select 1 from public.profiles where id = auth.uid() and company_role = 'ADMIN')
$$;

create function public.current_company_is_verified() returns boolean
language sql stable security definer set search_path = public, extensions, pg_temp as $$
  select exists (
    select 1 from public.profiles p join public.companies c on c.id = p.company_id
    where p.id = auth.uid() and c.kyc_status = 'VERIFIED'
  )
$$;

-- ─── Jurnal append-only ───────────────────────────────────────────────────
create function public.log_audit(p_company uuid, p_action text, p_entity text, p_entity_id uuid, p_details jsonb default '{}')
returns void language sql security definer set search_path = public, extensions, pg_temp as $$
  insert into public.audit_log (company_id, actor_id, action, entity, entity_id, details)
  values (p_company, auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_details, '{}'::jsonb))
$$;

create function public.notify_company(p_company uuid, p_kind text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = public, extensions, pg_temp as $$
  insert into public.notifications (company_id, kind, title, body, link)
  values (p_company, p_kind, left(p_title, 160), left(p_body, 500), p_link)
$$;

-- ─── updated_at ───────────────────────────────────────────────────────────
create function public.touch_updated_at() returns trigger
language plpgsql set search_path = public, extensions, pg_temp as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger vehicles_touch  before update on public.vehicles         for each row execute function public.touch_updated_at();
create trigger requests_touch  before update on public.freight_requests for each row execute function public.touch_updated_at();
create trigger bookings_touch  before update on public.bookings         for each row execute function public.touch_updated_at();

-- ─── Înregistrare: companie + profil din metadatele contului (K1) ─────────
-- Frontend-ul trimite la signUp: full_name, company_name, legal_form, idno,
-- company_kind, district_id. Orice valoare invalidă anulează înregistrarea.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_company uuid;
  v_district text := nullif(meta ->> 'district_id', '');
begin
  -- Conturi create manual din dashboard (ex. administratorul platformei) nu au companie.
  if nullif(btrim(meta ->> 'company_name'), '') is null then
    return new;
  end if;

  if v_district is not null and not exists (select 1 from public.districts where id = v_district) then
    raise exception 'raion necunoscut' using errcode = '22023';
  end if;

  insert into public.companies (name, legal_form, idno, kind, district_id, location)
  values (
    btrim(meta ->> 'company_name'),
    coalesce(meta ->> 'legal_form', 'SRL'),
    meta ->> 'idno',
    coalesce(meta ->> 'company_kind', 'SHIPPER'),
    v_district,
    (select center from public.districts where id = v_district)
  )
  returning id into v_company;

  insert into public.profiles (id, company_id, full_name, company_role)
  values (new.id, v_company, left(btrim(meta ->> 'full_name'), 120), 'ADMIN');

  perform public.log_audit(v_company, 'COMPANY_REGISTERED', 'company', v_company,
                           jsonb_build_object('user_id', new.id));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Zona deservită: raioane existente, fără dubluri, sortate ─────────────
create function public.vehicles_normalize_area() returns trigger
language plpgsql set search_path = public, extensions, pg_temp as $$
declare v_bad text;
begin
  select x into v_bad from unnest(new.service_district_ids) x
  where not exists (select 1 from public.districts d where d.id = x) limit 1;
  if v_bad is not null then
    raise exception 'Raion necunoscut în zona deservită: %.', v_bad using errcode = '23503';
  end if;
  new.service_district_ids := array(select distinct x from unnest(new.service_district_ids) x order by x);
  return new;
end $$;

create trigger vehicles_area before insert or update of service_district_ids on public.vehicles
  for each row execute function public.vehicles_normalize_area();

-- ─── Agregare încărcătură pe vehicul (paleți proprii ai transportatorului) ─
create function public.refresh_vehicle_occupancy(p_vehicle uuid) returns void
language sql security definer set search_path = public, extensions, pg_temp as $$
  update public.vehicles v set
    occupied_pallets   = coalesce(s.cnt, 0),
    occupied_weight_kg = coalesce(s.kg, 0)
  from (
    select count(*)::int as cnt, sum(weight_kg)::int as kg
    from public.vehicle_loads where vehicle_id = p_vehicle and status = 'OCCUPIED'
  ) s
  where v.id = p_vehicle
$$;

create function public.vehicle_loads_changed() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  perform public.refresh_vehicle_occupancy(coalesce(new.vehicle_id, old.vehicle_id));
  return null;
end $$;

create trigger vehicle_loads_occupancy
  after insert or update or delete on public.vehicle_loads
  for each row execute function public.vehicle_loads_changed();

-- ─── Mesaj cu ofertă de preț → actualizează rezervarea ────────────────────
create function public.booking_message_price() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  b public.bookings;
  side text;
begin
  select * into b from public.bookings where id = new.booking_id;
  side := case when new.sender_company_id = b.shipper_company_id then 'SHIPPER' else 'CARRIER' end;

  if new.price_mdl is not null and b.status in ('NEGOTIATING', 'AGREED') then
    -- Un preț nou invalidează orice contract generat/semnat pe prețul vechi.
    update public.bookings
       set price_mdl = new.price_mdl, price_proposed_by = side, status = 'NEGOTIATING',
           path = null, contract_snapshot = null, contract_hash = null,
           disclaimer_accepted_at = null, disclaimer_accepted_by = null,
           shipper_signed_at = null, shipper_signed_by = null,
           carrier_signed_at = null, carrier_signed_by = null
     where id = b.id;
  end if;

  perform public.notify_company(
    case when side = 'SHIPPER' then b.carrier_company_id else b.shipper_company_id end,
    'BOOKING_MESSAGE',
    case when new.price_mdl is not null then 'Ofertă nouă: ' || new.price_mdl || ' MDL' else 'Mesaj nou în negociere' end,
    left(new.body, 200),
    '/bookings/' || b.id
  );
  return new;
end $$;

create trigger booking_messages_after_insert
  after insert on public.booking_messages
  for each row execute function public.booking_message_price();
