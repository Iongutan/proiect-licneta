-- ═══════════════════════════════════════════════════════════════════════════
-- OptiFleet B2B — Migration 003: Triggers + Funcții SQL Optimizate
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- TRIGGER: updated_at automat pe toate tabelele relevante
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_clusters_updated_at
    BEFORE UPDATE ON group_buy_clusters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_companies_updated_at
    BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ───────────────────────────────────────────────────────────────────────────
-- FUNCȚIE: find_pending_orders_in_radius
-- Folosit de motorul DBSCAN de clustering
-- ST_DWithin cu ::geography → distanțe reale în metri (nu grade)
-- Index GIST pe pickup_location → microsecunde chiar și la milioane de rânduri
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION find_pending_orders_in_radius(
    center_lon   DOUBLE PRECISION,
    center_lat   DOUBLE PRECISION,
    radius_m     DOUBLE PRECISION,
    window_start TIMESTAMPTZ,
    window_end   TIMESTAMPTZ
)
RETURNS SETOF orders
LANGUAGE SQL STABLE PARALLEL SAFE AS $$
    SELECT o.*
    FROM orders o
    WHERE
        o.status = 'PENDING'
        AND ST_DWithin(
            o.pickup_location::geography,
            ST_SetSRID(ST_MakePoint(center_lon, center_lat), 4326)::geography,
            radius_m
        )
        AND o.delivery_window_start < window_end
        AND o.delivery_window_end   > window_start
    ORDER BY
        o.pickup_location::geography <->
        ST_SetSRID(ST_MakePoint(center_lon, center_lat), 4326)::geography
    LIMIT 500;
$$;


-- ───────────────────────────────────────────────────────────────────────────
-- FUNCȚIE: find_nearest_vehicles
-- KNN Spatial: K vehicule disponibile cel mai aproape de o locație
-- Operatorul <-> = K-Nearest Neighbor pe index GIST (extrem de rapid)
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION find_nearest_vehicles(
    target_lon       DOUBLE PRECISION,
    target_lat       DOUBLE PRECISION,
    max_radius_m     DOUBLE PRECISION DEFAULT 200000,   -- 200km default
    min_capacity_m3  DOUBLE PRECISION DEFAULT 0,
    min_weight_kg    DOUBLE PRECISION DEFAULT 0,
    k                INTEGER DEFAULT 10
)
RETURNS SETOF vehicles
LANGUAGE SQL STABLE PARALLEL SAFE AS $$
    SELECT v.*
    FROM vehicles v
    WHERE
        v.status = 'AVAILABLE'
        AND v.current_location IS NOT NULL
        AND v.capacity_m3  >= min_capacity_m3
        AND v.max_weight_kg >= min_weight_kg
        AND ST_DWithin(
            v.current_location::geography,
            ST_SetSRID(ST_MakePoint(target_lon, target_lat), 4326)::geography,
            max_radius_m
        )
    ORDER BY
        v.current_location::geography <->
        ST_SetSRID(ST_MakePoint(target_lon, target_lat), 4326)::geography
    LIMIT k;
$$;


-- ───────────────────────────────────────────────────────────────────────────
-- FUNCȚIE: calculate_cluster_stats
-- Actualizează statisticile unui cluster după adăugarea/eliminarea comenzilor
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION refresh_cluster_stats(p_cluster_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
    v_total_vol   NUMERIC;
    v_total_wt    NUMERIC;
    v_order_count INTEGER;
    v_center      GEOMETRY;
    v_hull        GEOMETRY;
    v_discount    NUMERIC;
BEGIN
    SELECT
        COALESCE(SUM(volume_m3), 0),
        COALESCE(SUM(weight_kg), 0),
        COUNT(*),
        ST_Centroid(ST_Collect(pickup_location)),
        ST_ConvexHull(ST_Collect(pickup_location))
    INTO v_total_vol, v_total_wt, v_order_count, v_center, v_hull
    FROM orders
    WHERE cluster_id = p_cluster_id AND status = 'CLUSTERED';

    -- Discount: 5% per comandă adițională, max 35%
    v_discount := LEAST(5.0 * GREATEST(v_order_count - 1, 0), 35.0);

    UPDATE group_buy_clusters SET
        total_volume_m3    = v_total_vol,
        total_weight_kg    = v_total_wt,
        estimated_discount = v_discount,
        center_location    = v_center,
        convex_hull        = v_hull,
        updated_at         = NOW()
    WHERE id = p_cluster_id;
END;
$$;


-- ───────────────────────────────────────────────────────────────────────────
-- TRIGGER: actualizează automat stats cluster la fiecare modificare order
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_refresh_cluster_on_order_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.cluster_id IS NOT NULL THEN
        PERFORM refresh_cluster_stats(NEW.cluster_id);
    END IF;
    IF OLD.cluster_id IS NOT NULL AND OLD.cluster_id != NEW.cluster_id THEN
        PERFORM refresh_cluster_stats(OLD.cluster_id);
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_order_cluster_refresh
    AFTER UPDATE OF cluster_id, status ON orders
    FOR EACH ROW EXECUTE FUNCTION trg_refresh_cluster_on_order_change();


-- ───────────────────────────────────────────────────────────────────────────
-- FUNCȚIE: JWT helper (pentru RLS Policies)
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auth_company_id() RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER AS $$
    SELECT (auth.jwt() ->> 'company_id')::UUID;
$$;

CREATE OR REPLACE FUNCTION auth_user_role() RETURNS TEXT
LANGUAGE SQL STABLE SECURITY DEFINER AS $$
    SELECT auth.jwt() ->> 'role';
$$;
