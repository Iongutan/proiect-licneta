-- ═══════════════════════════════════════════════════════════════════════════
-- OptiFleet B2B — Migration 004: Row Level Security (RLS)
-- SECURITATE: Compania X nu poate vedea datele companiei Y
-- ═══════════════════════════════════════════════════════════════════════════

-- Activare RLS pe toate tabelele sensibile
ALTER TABLE companies          ENABLE ROW LEVEL SECURITY;
ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders             ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_buy_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes             ENABLE ROW LEVEL SECURITY;

-- ───────────────────────────────────────────────────────────────────────────
-- COMPANIES — Fiecare vede propria companie
-- ───────────────────────────────────────────────────────────────────────────
CREATE POLICY "company_self_read"
ON companies FOR SELECT
USING (id = auth_company_id());

-- SUPER_ADMIN poate vedea toate companiile
CREATE POLICY "superadmin_all_companies"
ON companies FOR ALL
USING (auth_user_role() = 'SUPER_ADMIN');

-- ───────────────────────────────────────────────────────────────────────────
-- ORDERS — Izolare completă între companii
-- ───────────────────────────────────────────────────────────────────────────

-- SME vede și gestionează comenzile proprii
CREATE POLICY "sme_own_orders_read"
ON orders FOR SELECT
USING (company_id = auth_company_id());

CREATE POLICY "sme_own_orders_insert"
ON orders FOR INSERT
WITH CHECK (company_id = auth_company_id());

CREATE POLICY "sme_own_orders_update"
ON orders FOR UPDATE
USING (company_id = auth_company_id())
WITH CHECK (
    company_id = auth_company_id()
    AND status NOT IN ('DELIVERED', 'CANCELLED')  -- Nu poate modifica comenzi finale
);

-- Carrier vede comenzile alocate vehiculelor sale (prin cluster → route → vehicle)
CREATE POLICY "carrier_sees_assigned_orders"
ON orders FOR SELECT
USING (
    cluster_id IN (
        SELECT gc.id
        FROM group_buy_clusters gc
        JOIN routes r ON r.cluster_id = gc.id
        JOIN vehicles v ON r.vehicle_id = v.id
        WHERE v.carrier_id = auth_company_id()
        AND r.status IN ('PLANNED', 'ACTIVE')
    )
);

-- SUPER_ADMIN vede tot
CREATE POLICY "superadmin_all_orders"
ON orders FOR ALL
USING (auth_user_role() = 'SUPER_ADMIN');

-- ───────────────────────────────────────────────────────────────────────────
-- VEHICLES — Carrier gestionează doar flota sa
-- ───────────────────────────────────────────────────────────────────────────
CREATE POLICY "carrier_own_vehicles"
ON vehicles FOR ALL
USING (carrier_id = auth_company_id())
WITH CHECK (carrier_id = auth_company_id());

-- SME poate vedea vehiculele în tranzit spre comenzile sale
CREATE POLICY "sme_sees_active_vehicles"
ON vehicles FOR SELECT
USING (
    id IN (
        SELECT r.vehicle_id
        FROM routes r
        JOIN group_buy_clusters gc ON r.cluster_id = gc.id
        JOIN orders o ON o.cluster_id = gc.id
        WHERE o.company_id = auth_company_id()
        AND r.status = 'ACTIVE'
    )
);

-- SUPER_ADMIN vede tot
CREATE POLICY "superadmin_all_vehicles"
ON vehicles FOR ALL
USING (auth_user_role() = 'SUPER_ADMIN');

-- ───────────────────────────────────────────────────────────────────────────
-- CLUSTERS — Vizibil pentru companiile participante
-- ───────────────────────────────────────────────────────────────────────────
CREATE POLICY "participant_sees_cluster"
ON group_buy_clusters FOR SELECT
USING (
    id IN (
        SELECT cluster_id FROM orders
        WHERE company_id = auth_company_id()
        AND cluster_id IS NOT NULL
    )
);

CREATE POLICY "superadmin_all_clusters"
ON group_buy_clusters FOR ALL
USING (auth_user_role() = 'SUPER_ADMIN');

-- ───────────────────────────────────────────────────────────────────────────
-- ROUTES — Carrier vede rutele proprii, SME vede ruta comenzilor sale
-- ───────────────────────────────────────────────────────────────────────────
CREATE POLICY "carrier_own_routes"
ON routes FOR ALL
USING (
    vehicle_id IN (
        SELECT id FROM vehicles WHERE carrier_id = auth_company_id()
    )
);

CREATE POLICY "sme_sees_order_routes"
ON routes FOR SELECT
USING (
    cluster_id IN (
        SELECT cluster_id FROM orders
        WHERE company_id = auth_company_id()
        AND cluster_id IS NOT NULL
    )
);

CREATE POLICY "superadmin_all_routes"
ON routes FOR ALL
USING (auth_user_role() = 'SUPER_ADMIN');
