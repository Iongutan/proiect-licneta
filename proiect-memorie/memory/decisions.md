# Decizii importante de arhitectură / proiect

Format pentru fiecare decizie nouă:

```
## [DATA] — Titlu scurt al deciziei
- Context: de ce a apărut nevoia
- Decizie: ce s-a ales
- Alternative respinse: ce altceva s-a luat în calcul și de ce nu
```

---

(gol — nicio decizie înregistrată încă)

## 2026-09-26 — Eliminare API Rust
- Context: `api/` (Axum) verifica JWT HS256 cu un secret propriu, deci nu putea valida token-urile Supabase (chei noi asimetrice/JWKS); `/auth/login` emitea token pentru orice rol; jumătate din endpoint-uri erau stub-uri.
- Decizie: arhitectura devine Next.js (App Router) + Supabase (Auth, Postgres/PostGIS, RLS, Realtime, Storage) + `ml_service` (Python, intern, pentru DBSCAN/CVRP/AI). Securitatea datelor e impusă în baza de date prin RLS și funcții `SECURITY DEFINER` cu verificări explicite.
- Alternative respinse: repararea API-ului Rust (dublează autorizarea Supabase, mult cod de întreținut pentru un singur dezvoltator).

## 2026-09-26 — Fără mod demo / localStorage
- Context: frontend-ul funcționa pe date din localStorage și un login fals cu rolul ales din UI.
- Decizie: toate datele în Supabase; datele de prezentare devin seed SQL; conturile de test se creează din dashboard, fără parole în git.
- Alternative respinse: comutator „Demo” separat (suprafață de atac + cod dublu).

## 2026-09-26 — Rolul aplicației nu stă în claim-ul JWT `role`
- Context: hook-ul vechi scria `role = SUPER_ADMIN` în JWT; Supabase folosește acel claim ca rol Postgres → PostgREST cădea.
- Decizie: rolul și compania se citesc din `profiles` prin funcții `SECURITY DEFINER` (`current_company_id()`, `is_platform_admin()`); fără hook JWT de configurat manual.
