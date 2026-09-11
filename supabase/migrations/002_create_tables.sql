-- ═══════════════════════════════════════════════════════════════════════════
-- OptiFleet B2B — Migration 002: Create All Tables
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- COMPANIES
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 200),
    type        TEXT NOT NULL CHECK (type IN ('SME', 'CARRIER', 'SUPPLIER')),
    email       TEXT UNIQUE NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    phone       TEXT,
    address     TEXT,
    city        TEXT,
    location    GEOMETRY(Point, 4326),      -- Coordonate GPS sediu
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    metadata    JSONB DEFAULT '{}',          -- Câmpuri extensibile fără migrație
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_location ON companies USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_companies_type ON companies(type);
CREATE INDEX IF NOT EXISTS idx_companies_email ON companies(email);
CREATE INDEX IF NOT EXISTS idx_companies_active ON companies(is_active) WHERE is_active = TRUE;

-- ───────────────────────────────────────────────────────────────────────────
-- USERS (legat de Supabase Auth)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    role        TEXT NOT NULL CHECK (role IN (
                    'SUPER_ADMIN', 'CARRIER_ADMIN', 'CARRIER_DRIVER',
                    'SME_ADMIN', 'SME_USER', 'SUPPLIER'
                )),
    full_name   TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    last_login  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_company ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ───────────────────────────────────────────────────────────────────────────
-- GROUP BUY CLUSTERS (creat înainte de orders pentru FK)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS group_buy_clusters (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    status               TEXT NOT NULL DEFAULT 'FORMING'
                         CHECK (status IN ('FORMING','READY','ASSIGNED','COMPLETED','CANCELLED')),
    total_volume_m3      NUMERIC(10,3) NOT NULL DEFAULT 0 CHECK (total_volume_m3 >= 0),
    total_weight_kg      NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (total_weight_kg >= 0),
    estimated_discount   NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (estimated_discount BETWEEN 0 AND 100),
    center_location      GEOMETRY(Point, 4326),
    convex_hull          GEOMETRY(Polygon, 4326),           -- Poligon convex al comenzilor
    window_start         TIMESTAMPTZ,
    window_end           TIMESTAMPTZ,
    algorithm_used       TEXT DEFAULT 'DBSCAN',             -- Audit: ce algoritm a creat clusterul
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_cluster_window CHECK (
        window_end IS NULL OR window_start IS NULL OR window_end > window_start
    )
);

CREATE INDEX IF NOT EXISTS idx_clusters_status ON group_buy_clusters(status);
CREATE INDEX IF NOT EXISTS idx_clusters_center ON group_buy_clusters USING GIST(center_location);
CREATE INDEX IF NOT EXISTS idx_clusters_forming ON group_buy_clusters(created_at)
    WHERE status IN ('FORMING', 'READY');

-- ───────────────────────────────────────────────────────────────────────────
-- ORDERS
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id              UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    cluster_id              UUID REFERENCES group_buy_clusters(id) ON DELETE SET NULL,
    volume_m3               NUMERIC(10,3) NOT NULL
                            CHECK (volume_m3 > 0 AND volume_m3 <= 100),
    weight_kg               NUMERIC(10,2) NOT NULL
                            CHECK (weight_kg > 0 AND weight_kg <= 25000),
    width_cm                NUMERIC(8,2) CHECK (width_cm > 0),
    height_cm               NUMERIC(8,2) CHECK (height_cm > 0),
    depth_cm                NUMERIC(8,2) CHECK (depth_cm > 0),
    is_fragile              BOOLEAN NOT NULL DEFAULT FALSE,
    requires_refrigeration  BOOLEAN NOT NULL DEFAULT FALSE,
    status                  TEXT NOT NULL DEFAULT 'PENDING'
                            CHECK (status IN (
                                'PENDING','CLUSTERED','ASSIGNED',
                                'IN_TRANSIT','DELIVERED','CANCELLED'
                            )),
    pickup_location         GEOMETRY(Point, 4326) NOT NULL,
    dropoff_location        GEOMETRY(Point, 4326) NOT NULL,
    pickup_address          TEXT,
    dropoff_address         TEXT,
    delivery_window_start   TIMESTAMPTZ NOT NULL,
    delivery_window_end     TIMESTAMPTZ NOT NULL,
    special_instructions    TEXT,
    metadata                JSONB DEFAULT '{}',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_delivery_window CHECK (delivery_window_end > delivery_window_start),
    CONSTRAINT valid_volume_vs_dims CHECK (
        width_cm IS NULL OR height_cm IS NULL OR depth_cm IS NULL OR
        (width_cm * height_cm * depth_cm / 1000000) <= volume_m3 * 1.1  -- 10% toleranță
    )
);

CREATE INDEX IF NOT EXISTS idx_orders_company ON orders(company_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_cluster ON orders(cluster_id);
CREATE INDEX IF NOT EXISTS idx_orders_pickup_loc ON orders USING GIST(pickup_location);
CREATE INDEX IF NOT EXISTS idx_orders_dropoff_loc ON orders USING GIST(dropoff_location);
-- Index spațio-temporal pentru clustering: găsește comenzi în zonă ȘI în fereastră temporală
CREATE INDEX IF NOT EXISTS idx_orders_pending_spatial ON orders USING GIST(
    pickup_location
) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

-- ───────────────────────────────────────────────────────────────────────────
-- VEHICLES
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicles (
    id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    carrier_id           UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    license_plate        TEXT UNIQUE NOT NULL CHECK (length(license_plate) BETWEEN 4 AND 20),
    capacity_m3          NUMERIC(8,3) NOT NULL CHECK (capacity_m3 > 0 AND capacity_m3 <= 200),
    max_weight_kg        NUMERIC(10,2) NOT NULL CHECK (max_weight_kg > 0 AND max_weight_kg <= 50000),
    max_width_cm         NUMERIC(8,2) CHECK (max_width_cm > 0),
    max_height_cm        NUMERIC(8,2) CHECK (max_height_cm > 0),
    max_depth_cm         NUMERIC(8,2) CHECK (max_depth_cm > 0),
    status               TEXT NOT NULL DEFAULT 'AVAILABLE'
                         CHECK (status IN ('AVAILABLE','ON_ROUTE','MAINTENANCE','OFFLINE')),
    current_location     GEOMETRY(Point, 4326),
    current_city         TEXT,
    driver_name          TEXT,
    driver_phone         TEXT,                               -- ATENȚIE: stocat plain, criptează în prod
    last_location_update TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicles_carrier ON vehicles(carrier_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
-- Index spațial DOAR pe vehicule disponibile (cel mai util pentru KNN)
CREATE INDEX IF NOT EXISTS idx_vehicles_available_loc ON vehicles USING GIST(current_location)
    WHERE status = 'AVAILABLE' AND current_location IS NOT NULL;

-- ───────────────────────────────────────────────────────────────────────────
-- ROUTES
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS routes (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id          UUID NOT NULL REFERENCES vehicles(id),
    cluster_id          UUID REFERENCES group_buy_clusters(id),
    status              TEXT NOT NULL DEFAULT 'PLANNED'
                        CHECK (status IN ('PLANNED','ACTIVE','COMPLETED','CANCELLED')),
    waypoints_geojson   JSONB NOT NULL DEFAULT '[]',         -- Array [{lat, lon, order_id, type}]
    route_geometry      GEOMETRY(LineString, 4326),          -- Geometrie OSRM pentru Mapbox
    total_distance_km   NUMERIC(10,2) CHECK (total_distance_km >= 0),
    estimated_time_min  INTEGER CHECK (estimated_time_min >= 0),
    co2_saved_kg        NUMERIC(8,2) CHECK (co2_saved_kg >= 0),
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_routes_vehicle ON routes(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_routes_cluster ON routes(cluster_id);
CREATE INDEX IF NOT EXISTS idx_routes_status ON routes(status);
CREATE INDEX IF NOT EXISTS idx_routes_active ON routes(started_at)
    WHERE status = 'ACTIVE';

-- ───────────────────────────────────────────────────────────────────────────
-- AUDIT LOG (append-only — niciodată UPDATE sau DELETE!)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
    id          BIGSERIAL PRIMARY KEY,
    entity_type TEXT NOT NULL,                  -- 'order', 'vehicle', 'cluster', 'route'
    entity_id   UUID NOT NULL,
    action      TEXT NOT NULL,                  -- 'CREATE', 'UPDATE', 'STATUS_CHANGE', 'DELETE'
    actor_id    UUID,                           -- user_id care a efectuat acțiunea
    actor_email TEXT,
    old_data    JSONB,
    new_data    JSONB,
    ip_address  INET,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
