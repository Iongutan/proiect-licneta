-- ═══════════════════════════════════════════════════════════════════════════
-- OptiFleet B2B — Migration 006: Custom JWT Claims
--
-- PROBLEMĂ: RLS policies folosesc auth.jwt() ->> 'company_id' și 'role'.
-- Supabase JWT-ul standard NU conține aceste câmpuri.
-- SOLUȚIE: Hook function care injectează company_id și role în JWT.
--
-- Rulează DUPĂ 004_rls_policies.sql și ÎNAINTE de seed.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Funcție hook: injectează custom claims în JWT ────────────────────────
-- Supabase o apelează automat la fiecare login/refresh token
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    claims       JSONB;
    user_id      UUID;
    user_role    TEXT;
    company_uuid UUID;
BEGIN
    -- Extrage user_id din event
    user_id := (event ->> 'user_id')::UUID;
    claims   := event -> 'claims';

    -- Citește rolul și company_id din tabela noastră users
    SELECT u.role, u.company_id
    INTO user_role, company_uuid
    FROM public.users u
    WHERE u.id = user_id
    LIMIT 1;

    -- Dacă userul există în tabela noastră, adaugă claims custom
    IF user_role IS NOT NULL THEN
        claims := jsonb_set(claims, '{role}',       to_jsonb(user_role));
        claims := jsonb_set(claims, '{company_id}', to_jsonb(company_uuid::TEXT));
    END IF;

    -- Returnează event modificat
    RETURN jsonb_set(event, '{claims}', claims);

EXCEPTION WHEN OTHERS THEN
    -- Dacă apare orice eroare, returnează event nemodificat (nu bloca login-ul!)
    RETURN event;
END;
$$;

-- ─── 2. Acordă permisiuni funcției hook ──────────────────────────────────────
-- Supabase Auth rulează cu rolul supabase_auth_admin
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- Funcția poate citi tabela users
GRANT SELECT ON public.users TO supabase_auth_admin;


-- ─── 3. INSTRUCȚIUNI MANUALE (nu se pot face prin SQL) ───────────────────────
-- 
-- După ce rulezi acest script, mergi în Supabase Dashboard:
-- Authentication → Hooks → "Custom Access Token"
--   Function: public.custom_access_token_hook
--   Enable: ON
--
-- Aceasta asigură că JWT-ul fiecărui utilizator conține:
--   { "role": "SME_ADMIN", "company_id": "5e100000-..." }
-- ═══════════════════════════════════════════════════════════════════════════
