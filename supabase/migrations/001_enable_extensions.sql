-- ═══════════════════════════════════════════════════════════════════════════
-- OptiFleet B2B — Migration 001: Enable Extensions
-- Rulează în Supabase SQL Editor ÎNAINTE de orice altă migrație
-- ═══════════════════════════════════════════════════════════════════════════

-- Extensia PostGIS: suport coordonate GPS, distanțe geografice, indexuri GIST
CREATE EXTENSION IF NOT EXISTS postgis;

-- UUID generation: uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Full-text search în câmpuri text (adrese, instrucțiuni)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Index compus GiST+Btree (pentru queries combinate geo + temporal)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Verificare
SELECT postgis_version() AS postgis_ok;
SELECT uuid_generate_v4() AS uuid_ok;
