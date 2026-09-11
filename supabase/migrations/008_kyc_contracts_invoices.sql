-- ═══════════════════════════════════════════════════════════════════════════
-- OptiFleet B2B — Migration 008: KYC, B2B Contracts & Invoices with RLS
-- Conformitate: Legea RM nr. 133/2011, Codul Transporturilor nr. 150/2014 & RLS
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1. COMPANY KYC (Verificare Agenția Servicii Publice & ANTA)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS company_kyc (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id              UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    legal_name              TEXT NOT NULL CHECK (length(legal_name) BETWEEN 2 AND 250),
    legal_form              TEXT NOT NULL CHECK (legal_form IN ('SRL', 'II', 'SA', 'ALTA')),
    idno                    VARCHAR(13) NOT NULL CHECK (length(idno) = 13),
    vat_number              TEXT,
    administrator_name      TEXT NOT NULL,
    administrator_idnp      VARCHAR(13),  -- IDNP protejat conform Legii nr. 133/2011
    registered_address      TEXT NOT NULL,
    bank_name               TEXT NOT NULL,
    iban_mdl                VARCHAR(24) NOT NULL,
    anta_license_number     TEXT,
    anta_license_expiry     DATE,
    insurance_policy_number TEXT,
    document_asp_url        TEXT,
    document_anta_url       TEXT,
    document_insurance_url  TEXT,
    status                  TEXT NOT NULL DEFAULT 'PENDING'
                            CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
    rejection_reason        TEXT,
    submitted_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at             TIMESTAMPTZ,
    reviewed_by             UUID REFERENCES users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kyc_company ON company_kyc(company_id);
CREATE INDEX IF NOT EXISTS idx_kyc_idno ON company_kyc(idno);
CREATE INDEX IF NOT EXISTS idx_kyc_status ON company_kyc(status);

-- ───────────────────────────────────────────────────────────────────────────
-- 2. DIGITAL CONTRACTS (Contracte B2B cu amprentă criptografică SHA-256)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS digital_contracts (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_number         TEXT UNIQUE NOT NULL,
    cluster_id              UUID REFERENCES group_buy_clusters(id) ON DELETE SET NULL,
    carrier_company_id      UUID NOT NULL REFERENCES companies(id),
    shipper_company_id      UUID NOT NULL REFERENCES companies(id),
    sha256_hash             CHAR(64) NOT NULL, -- Amprentă criptografică unică
    corridor_name           TEXT NOT NULL,
    total_value_mdl         NUMERIC(12,2) NOT NULL CHECK (total_value_mdl >= 0),
    carrier_payout_mdl      NUMERIC(12,2) NOT NULL CHECK (carrier_payout_mdl >= 0),
    platform_fee_mdl        NUMERIC(12,2) NOT NULL CHECK (platform_fee_mdl >= 0),
    status                  TEXT NOT NULL DEFAULT 'PENDING_ACCEPTANCE'
                            CHECK (status IN ('PENDING_ACCEPTANCE', 'ACTIVE', 'COMPLETED', 'DISPUTED', 'CANCELLED')),
    terms_version           TEXT NOT NULL DEFAULT 'v2.1-UTM-RM',
    accepted_by_user        UUID REFERENCES users(id),
    accepted_at             TIMESTAMPTZ,
    accepted_ip             INET,
    signed_document_url     TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contracts_carrier ON digital_contracts(carrier_company_id);
CREATE INDEX IF NOT EXISTS idx_contracts_shipper ON digital_contracts(shipper_company_id);
CREATE INDEX IF NOT EXISTS idx_contracts_cluster ON digital_contracts(cluster_id);
CREATE INDEX IF NOT EXISTS idx_contracts_hash ON digital_contracts(sha256_hash);

-- ───────────────────────────────────────────────────────────────────────────
-- 3. INVOICES & FINANCIAL LEDGER (Registru încasări, plăți și comisioane)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number          TEXT UNIQUE NOT NULL,
    company_id              UUID NOT NULL REFERENCES companies(id),
    cluster_id              UUID REFERENCES group_buy_clusters(id),
    contract_id             UUID REFERENCES digital_contracts(id),
    amount_gross_mdl        NUMERIC(12,2) NOT NULL CHECK (amount_gross_mdl >= 0),
    vat_amount_mdl          NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (vat_amount_mdl >= 0),
    platform_fee_mdl        NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (platform_fee_mdl >= 0),
    carrier_payout_mdl      NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (carrier_payout_mdl >= 0),
    status                  TEXT NOT NULL DEFAULT 'PENDING_PAYMENT'
                            CHECK (status IN ('PENDING_PAYMENT', 'PAID', 'OVERDUE', 'CANCELLED')),
    due_date                DATE NOT NULL,
    paid_at                 TIMESTAMPTZ,
    payment_method          TEXT,
    pdf_url                 TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due ON invoices(due_date);

-- ───────────────────────────────────────────────────────────────────────────
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE company_kyc       ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices          ENABLE ROW LEVEL SECURITY;

-- 4.1. KYC Policies
-- Compania își poate citi propriul dosar KYC
CREATE POLICY "company_read_own_kyc"
ON company_kyc FOR SELECT
USING (company_id = auth_company_id());

-- Compania își poate încărca propriul dosar KYC
CREATE POLICY "company_insert_own_kyc"
ON company_kyc FOR INSERT
WITH CHECK (company_id = auth_company_id());

-- Doar SUPER_ADMIN poate aproba/respinge sau citi toate dosarele KYC
CREATE POLICY "superadmin_manage_all_kyc"
ON company_kyc FOR ALL
USING (auth_user_role() = 'SUPER_ADMIN');

-- 4.2. Digital Contracts Policies
-- Părțile implicate (transportatorul sau comerciantul) pot citi contractul
CREATE POLICY "parties_read_contract"
ON digital_contracts FOR SELECT
USING (
    carrier_company_id = auth_company_id()
    OR shipper_company_id = auth_company_id()
);

-- Doar transportatorul alocat poate accepta contractul
CREATE POLICY "carrier_accept_contract"
ON digital_contracts FOR UPDATE
USING (carrier_company_id = auth_company_id())
WITH CHECK (carrier_company_id = auth_company_id());

-- SUPER_ADMIN poate vedea și audita toate contractele
CREATE POLICY "superadmin_all_contracts"
ON digital_contracts FOR ALL
USING (auth_user_role() = 'SUPER_ADMIN');

-- 4.3. Invoices Policies
-- Fiecare companie își vede doar propriile facturi
CREATE POLICY "company_read_own_invoices"
ON invoices FOR SELECT
USING (company_id = auth_company_id());

-- SUPER_ADMIN vede și gestionează toate facturile din platformă
CREATE POLICY "superadmin_all_invoices"
ON invoices FOR ALL
USING (auth_user_role() = 'SUPER_ADMIN');
