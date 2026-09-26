-- ═══════════════════════════════════════════════════════════════════════════
-- OptiFleet v2 — 01: extensii și întărirea schemei public
-- ═══════════════════════════════════════════════════════════════════════════

create schema if not exists extensions;
create extension if not exists postgis  with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- Nimeni în afară de owner nu poate crea obiecte în public: funcțiile
-- SECURITY DEFINER cu search_path = public, extensions nu pot fi deturnate.
revoke create on schema public from public;
revoke create on schema public from anon, authenticated;

-- Funcțiile noi NU mai primesc EXECUTE automat pentru toată lumea;
-- fiecare RPC primește explicit doar rolurile de care are nevoie.
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated;
