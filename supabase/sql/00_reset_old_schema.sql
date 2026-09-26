-- ═══════════════════════════════════════════════════════════════════════════
-- OptiFleet v2 — 00: ȘTERGE schema veche (v1)
--
-- ATENȚIE: ireversibil. Rulează O SINGURĂ DATĂ, doar dacă proiectul Supabase
-- conține tabelele vechi (companies, users, orders, group_buy_clusters, ...).
-- Șterge și cele 3 conturi demo vechi ale căror parole au fost publicate în git.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

drop table if exists public.invoices            cascade;
drop table if exists public.digital_contracts   cascade;
drop table if exists public.company_kyc         cascade;
drop table if exists public.routes              cascade;
drop table if exists public.orders              cascade;
drop table if exists public.group_buy_clusters  cascade;
drop table if exists public.vehicles            cascade;
drop table if exists public.users               cascade;
drop table if exists public.audit_log           cascade;
drop table if exists public.companies           cascade;

drop function if exists public.custom_access_token_hook(jsonb)  cascade;
drop function if exists public.auth_company_id()                cascade;
drop function if exists public.auth_user_role()                 cascade;
drop function if exists public.find_pending_orders_in_radius(double precision, double precision, double precision, timestamptz, timestamptz) cascade;
drop function if exists public.find_nearest_vehicles(double precision, double precision, double precision, double precision, double precision, integer) cascade;
drop function if exists public.refresh_cluster_stats(uuid)      cascade;
drop function if exists public.trg_refresh_cluster_on_order_change() cascade;
drop function if exists public.update_updated_at()              cascade;

-- Conturile demo v1 (parolele lor au fost în repo-ul public).
delete from auth.users where id in (
  'a1b2c3d4-0000-0000-0000-000000000001',
  'ca100000-0000-0000-0000-0000000000aa',
  '5e100000-0000-0000-0000-0000000000aa'
);

commit;

-- După rulare: Authentication → Hooks → dezactivează „Custom Access Token”
-- dacă fusese activat pentru public.custom_access_token_hook.
