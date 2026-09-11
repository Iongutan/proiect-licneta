-- ═══════════════════════════════════════════════════════════════════════════
-- OptiFleet B2B — Migration 009: Creare Utilizatori Predefiniți și Administrator
-- Rulează în Supabase SQL Editor pentru a avea conturi gata de autentificare
-- ═══════════════════════════════════════════════════════════════════════════

-- Activare extensie pentru criptare parole (standard în Postgres / Supabase)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Compania Platformei de Administrare
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO public.companies (id, name, type, email, phone, city, is_active)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'OptiFleet B2B Platform SRL',
    'SME',
    'admin@optifleet.md',
    '+373 22 000 001',
    'Chișinău',
    true
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, email = EXCLUDED.email;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Utilizatori în auth.users (Supabase Auth)
-- ───────────────────────────────────────────────────────────────────────────

-- 2.1. ADMINISTRATOR GENERAL (SUPER_ADMIN)
-- Login:    admin@optifleet.md
-- Parolă:   AdminOptiFleet2026!
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'a1b2c3d4-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'admin@optifleet.md',
    crypt('AdminOptiFleet2026!', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Ion Guțan (Super Admin OptiFleet)"}',
    NOW(),
    NOW()
)
ON CONFLICT (id) DO UPDATE
SET encrypted_password = crypt('AdminOptiFleet2026!', gen_salt('bf')),
    email_confirmed_at = NOW();

-- 2.2. TRANSPORTATOR (CARRIER_ADMIN)
-- Login:    dispatch@transmold.md
-- Parolă:   CarrierOpti2026!
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'ca100000-0000-0000-0000-0000000000aa',
    'authenticated',
    'authenticated',
    'dispatch@transmold.md',
    crypt('CarrierOpti2026!', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Dispecerat TransMold Express"}',
    NOW(),
    NOW()
)
ON CONFLICT (id) DO UPDATE
SET encrypted_password = crypt('CarrierOpti2026!', gen_salt('bf')),
    email_confirmed_at = NOW();

-- 2.3. COMERCIANT / IMM (SME_ADMIN)
-- Login:    orders@techmold.md
-- Parolă:   MerchantOpti2026!
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    '5e100000-0000-0000-0000-0000000000aa',
    'authenticated',
    'authenticated',
    'orders@techmold.md',
    crypt('MerchantOpti2026!', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Departament Achiziții TechMold"}',
    NOW(),
    NOW()
)
ON CONFLICT (id) DO UPDATE
SET encrypted_password = crypt('MerchantOpti2026!', gen_salt('bf')),
    email_confirmed_at = NOW();

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Legare în public.users cu Roluri și Companii
-- ───────────────────────────────────────────────────────────────────────────

-- Super Admin
INSERT INTO public.users (id, company_id, role, full_name, is_active)
VALUES (
    'a1b2c3d4-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'SUPER_ADMIN',
    'Ion Guțan (Super Admin)',
    true
)
ON CONFLICT (id) DO UPDATE
SET role = 'SUPER_ADMIN', is_active = true;

-- Carrier Admin (TransMold Express)
INSERT INTO public.users (id, company_id, role, full_name, is_active)
VALUES (
    'ca100000-0000-0000-0000-0000000000aa',
    'ca100000-0000-0000-0000-000000000001',
    'CARRIER_ADMIN',
    'Dispecer TransMold',
    true
)
ON CONFLICT (id) DO UPDATE
SET role = 'CARRIER_ADMIN', is_active = true;

-- SME Admin (TechMold Electronics)
INSERT INTO public.users (id, company_id, role, full_name, is_active)
VALUES (
    '5e100000-0000-0000-0000-0000000000aa',
    '5e100000-0000-0000-0000-000000000001',
    'SME_ADMIN',
    'Manager TechMold',
    true
)
ON CONFLICT (id) DO UPDATE
SET role = 'SME_ADMIN', is_active = true;
