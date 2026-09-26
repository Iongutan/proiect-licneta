-- ═══════════════════════════════════════════════════════════════════════════
-- OptiFleet v3 — 00: platforma locală (înlocuiește ce oferea Supabase)
--
-- Rulează ca superuser, înaintea fișierelor supabase/sql/01–10, care rămân
-- neschimbate: aceleași roluri (anon, authenticated), auth.uid(), schema
-- storage și publicația realtime. Autentificarea, fișierele și timpul real
-- sunt servite de aplicația Next.js, care se conectează ca rolul
-- optifleet_app și execută cererile utilizatorilor ca `authenticated`, cu
-- request.jwt.claim.sub = id-ul utilizatorului → RLS-ul se aplică neschimbat.
-- Idempotent: se poate rula de mai multe ori.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Roluri ───────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  -- Rolul aplicației: se autentifică, apoi face SET ROLE anon/authenticated
  -- pentru fiecare cerere. Parola o setează scriptul de pornire.
  if not exists (select 1 from pg_roles where rolname = 'optifleet_app') then
    create role optifleet_app login noinherit;
  end if;
end $$;

grant anon, authenticated to optifleet_app;
grant usage on schema public to anon, authenticated;

create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated;

-- ─── Autentificare ────────────────────────────────────────────────────────
create schema if not exists auth;
grant usage on schema auth to anon, authenticated, optifleet_app;

create table if not exists auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text not null check (email = lower(email) and char_length(email) between 3 and 254),
  encrypted_password  text,
  raw_user_meta_data  jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  last_sign_in_at     timestamptz
);
create unique index if not exists users_email_key on auth.users (email);

-- Sesiuni: în cookie stă doar tokenul aleator; aici doar hash-ul lui (SHA-256).
create table if not exists auth.sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  token_hash    text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  user_agent    text check (char_length(user_agent) <= 300),
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  last_seen_at  timestamptz not null default now()
);
create index if not exists sessions_user_idx on auth.sessions (user_id);
create index if not exists sessions_expires_idx on auth.sessions (expires_at);

-- Doar aplicația citește/scrie conturile și sesiunile; clienții niciodată.
revoke all on auth.users, auth.sessions from public, anon, authenticated;
grant select, insert, update (encrypted_password, last_sign_in_at, raw_user_meta_data) on auth.users to optifleet_app;
grant select, insert, update (last_seen_at), delete on auth.sessions to optifleet_app;

-- Același contract ca în Supabase: id-ul utilizatorului din setarea cererii.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid
$$;
grant execute on function auth.uid() to anon, authenticated, optifleet_app;

-- ─── Fișiere (dovezi foto, documente KYC) ─────────────────────────────────
-- Conținutul stă pe disc (.data/storage/<bucket>/<cale>); aici doar evidența,
-- pe care RLS o folosește pentru a decide cine poate încărca / citi.
create schema if not exists storage;
grant usage on schema storage to anon, authenticated;

create table if not exists storage.buckets (
  id                  text primary key,
  name                text not null,
  public              boolean not null default false,
  file_size_limit     bigint,
  allowed_mime_types  text[],
  created_at          timestamptz not null default now()
);

create table if not exists storage.objects (
  id          uuid primary key default gen_random_uuid(),
  bucket_id   text not null references storage.buckets (id),
  name        text not null check (name ~ '^[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*$' and name !~ '\.\.'),
  owner       uuid default auth.uid(),
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;
grant select on storage.buckets to anon, authenticated;
grant select, insert (bucket_id, name, metadata) on storage.objects to authenticated;

create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$
  select (string_to_array(name, '/'))[1:greatest(array_length(string_to_array(name, '/'), 1) - 1, 0)]
$$;
grant execute on function storage.foldername(text) to anon, authenticated;

-- ─── Realtime ─────────────────────────────────────────────────────────────
-- 06_storage_realtime.sql adaugă tabelele în această publicație; local ea doar
-- marchează tabelele urmărite. Notificările le trimit triggerele din 90_realtime.sql.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;
