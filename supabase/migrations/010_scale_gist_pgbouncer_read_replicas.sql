-- ═══════════════════════════════════════════════════════════════════
-- OptiFleet B2B — Migration 010: Indecși Spațiali GIST, PgBouncer & Read Replicas
-- PROMPT J6: Pregătire bază de date pentru 1.000.000 utilizatori concurenți
-- ═══════════════════════════════════════════════════════════════════

-- 1. INDECȘI SPAȚIALI GIST PE TOATE COLOANELE GEOMETRY
-- Esențiali pentru interogări spațiale rapide (KNN, DBSCAN, căutare pe rază în Moldova)
-- Fără acești indecși, căutările spațiale fac Seq Scan (lente la >10.000 rânduri)

-- 1.1 Trasee (OSRM LineString geometry) — LIPSEA ÎNAINTE DE AUDIT
CREATE INDEX IF NOT EXISTS idx_routes_geometry
    ON routes USING GIST(route_geometry);

-- 1.2 Comenzi: Pickup & Dropoff locations
CREATE INDEX IF NOT EXISTS idx_orders_pickup_loc
    ON orders USING GIST(pickup_location);

CREATE INDEX IF NOT EXISTS idx_orders_dropoff_loc
    ON orders USING GIST(dropoff_location);

-- 1.3 Index spațial parțial pentru comenzi PENDING (cele care intră în clustering)
CREATE INDEX IF NOT EXISTS idx_orders_pending_spatial_gist
    ON orders USING GIST(pickup_location)
    WHERE status = 'PENDING';

-- 1.4 Vehicule: Locație curentă în timp real (flotă)
CREATE INDEX IF NOT EXISTS idx_vehicles_current_loc_gist
    ON vehicles USING GIST(current_location);

-- 1.5 Vehicule disponibile pentru asignare rapidă (dispatch)
CREATE INDEX IF NOT EXISTS idx_vehicles_available_spatial_gist
    ON vehicles USING GIST(current_location)
    WHERE status = 'AVAILABLE';

-- 1.6 Clustere: Centru geometric
CREATE INDEX IF NOT EXISTS idx_clusters_center_gist
    ON group_buy_clusters USING GIST(center_location);

-- 1.7 Companii: Locație sediu / depozit
CREATE INDEX IF NOT EXISTS idx_companies_location_gist
    ON companies USING GIST(location);

-- 2. CONFIGURARE PGBOUNCER (CONNECTION POOLING PENTRU 1M UTILIZATORI)
-- Comentariu arhitectural:
-- La scară de 1.000.000 utilizatori, o singură instanță Postgres suportă nativ ~500 conexiuni.
-- PgBouncer în modul 'transaction' permite ca 10.000+ conexiuni concurente din API-ul Rust (Axum)
-- să refolosească un pool intern de 50-100 conexiuni reale Postgres fără epuizarea memoriei RAM.
--
-- Setări recomandate PgBouncer:
-- [databases]
-- optifleet = host=postgres port=5432 dbname=optifleet
--
-- [pgbouncer]
-- pool_mode = transaction
-- max_client_conn = 20000
-- default_pool_size = 50
-- min_pool_size = 10
-- reserve_pool_size = 10
-- max_db_connections = 100

-- 3. SUPORT PENTRU REPLICI DE CITIRE (READ REPLICAS)
-- La scară mare, 90% din trafic sunt operațiuni de citire (SELECT):
-- - Listare comenzi, istoric facturi, poziții vehicule, căutare clustere
-- Recomandare arhitecturală:
-- - Conexiunile de scriere (INSERT, UPDATE, DELETE) -> Postgres Primary (sau via PgBouncer port 6432)
-- - Conexiunile de citire (SELECT) -> Postgres Read Replicas (port 6433)
