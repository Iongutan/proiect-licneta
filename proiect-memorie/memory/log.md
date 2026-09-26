# Jurnal sesiuni

Fiecare sesiune adaugă o intrare nouă LA SFÂRȘIT. Nu se șterge nimic din
acest fișier niciodată.

---

## [inițializare] — setup inițial
- Structura de memorie a fost creată.
- Nicio sesiune de lucru nu a rulat încă.

## 2026-09-26 — Audit complet cod + mutare memorie în rădăcină
**Făcut:**
- `proiect-memorie/CLAUDE.md` mutat în `CLAUDE.md` (rădăcină) ca să fie citit
  automat; `MEMORY.md` duplicat eliminat.
- Audit complet: api (Rust), backend, ml_service, frontend, supabase, docker.

**Găsit — securitate (critic):**
- `api` `/auth/login` emite JWT pentru orice user_id/rol trimis, fără parolă.
- WebSocket `/ws/vehicle/:id` și `/ws/track/:id` fără autentificare.
- `ml_service` fără autentificare, portul 8001 publicat pe host.
- Login frontend: „reușește” și dacă Supabase refuză; rolul se alege din UI și
  se ține în localStorage; parola de admin afișată pe pagină.
- `/admin` fără nicio verificare de rol.
- Migrația 009 conține parole în clar; hook-ul JWT suprascrie claim-ul `role`
  (strică PostgREST); `audit_log` fără RLS.
- XSS: date vehicul interpolate în HTML Leaflet + `onclick` inline global.
- Grafana `admin/admin`, Redis/PgBouncer/Prometheus publicate pe host,
  PgBouncer cu parola implicită `postgres`.
- `/api/chat` și `/api/route` (Next) fără auth/limită; folosesc serverul
  public demo OSRM.
- `python-jose` (CVE-uri cunoscute).

**Găsit — funcțional:**
- Tot frontend-ul rulează pe date demo din localStorage; nimic persistat real.
- Imagini vehicule: toate tipurile (în afară de trailă) desenează același TIR;
  paleții limitați la 10 coloane.
- Configurator paleți: mereu 33 sloturi (și la duba de 4), sarcina 24 t fixă;
  constructorul K7 cu coliziuni e scris dar nu e folosit în UI.
- Vehiculele create în flotă nu apar pe hartă (chei localStorage diferite).
- Căutarea K4: rezultatele nu se afișează; ora de trecere = `Math.random()`.
- Panou AI/K5: date fixe în cod („BST 102 14:20”, „09:45”).
- Comandă nouă: coordonate fixe, fără paleți/tip vehicul — expeditorul fără
  mașini nu poate posta o cerere reală.
- Hash contract fals (`Math.random()`), semnătura doar vizuală.
- `backend/` = copie veche nefolosită a `ml_service/`.
- `api` Rust: clusters/vehicles sunt stub-uri; tracker WS dezabonează canalul
  pentru toți la prima deconectare.

**Rămas:** decizia de arhitectură + implementarea (vezi CLAUDE.md).

## 2026-09-26 (continuare) — Refacere completă v2
**Făcut** (branch `refresh/v2`, 5 commit-uri):
- `ml_service` → pachet `optifleet_ml` stateless: token intern, DBSCAN pe max(dist. preluare, dist. livrare) + ferestre de timp, CVRP pickup&delivery corect, intenție Qwen3 cu schemă JSON. 15 teste pytest.
- `docker-compose.yml` redus la osrm + ml_service, porturi pe 127.0.0.1, containere read-only.
- Schema Supabase v2 (`supabase/sql/`), testată în Docker (`supabase/tests/run.sh`, `api-contract.sh`).
- Frontend refăcut: auth SSR, CSP cu nonce, hartă K2–K5, flotă K6–K7, cereri + bursă + grupaj, contracte K8–K12, admin KYC.
- Documentație rescrisă: README, MANUAL_DE_PORNIRE, SECURITATE_SI_DATE_PERSONALE.

**Rămas:**
- Utilizatorul rulează SQL-ul în proiectul Supabase și setează Auth + adminul.
- Utilizatorul șterge fișierele v1 (ștergerea cu `git rm` a fost refuzată de clasificatorul de siguranță).
- Paginile cu login nu au fost văzute vizual pe date reale (fără migrații în cloud); datele și apelurile sunt însă acoperite de testul de contract.

**Atenționări:**
- Tokenul intern ML a fost generat și scris în `ml_service/.env` și `frontend/.env.local` (neversionate).
- `ml_service/.env` mai conține cheile Supabase vechi, acum nefolosite; pot fi șterse de acolo.
