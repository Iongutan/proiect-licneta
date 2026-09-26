# OptiFleet B2B — instrucțiuni permanente pentru Claude Code

Proiect de licență UTM (Ion Guțan, TI-233). Documentația de produs e în
`materiale/` — sursa principală pentru funcționalitate este
`materiale/viziune-si-prompturi-K-optifleet.md` (prompturile K1–K12), iar
pentru securitate `materiale/audit-securitate-scalare-optifleet.md` (J1–J10).

## Memoria proiectului

Memoria trăiește în acest fișier (starea curentă) și în `proiect-memorie/memory/`:

| Fișier | Conținut | Regulă |
|---|---|---|
| `CLAUDE.md` → „MEMORIE — stare curentă” | ce e gata, ce e în lucru, pașii următori | se **rescrie** complet |
| `proiect-memorie/memory/log.md` | jurnal sesiuni | **append-only**, nu se șterge nimic |
| `proiect-memorie/memory/decisions.md` | decizii de arhitectură | append |
| `proiect-memorie/memory/resurse.md` | pachete/librării evaluate | append |

La ÎNCEPUTUL fiecărei sesiuni:
1. Citește „MEMORIE — stare curentă” de mai jos și ultimele intrări din `log.md`.
2. Confirmă într-o propoziție de unde reiei (ex: „Am reluat de la X, urma Y”).

Pe parcursul lucrului:
- Înainte de a instala un pachet nou, verifică `resurse.md` — poate a fost deja evaluat sau respins.
- Pachet util găsit → adaugă-l în `resurse.md` (link + 1 linie + dată).
- Decizie de arhitectură → notează imediat în `decisions.md`.

ÎNAINTE de a încheia sesiunea (obligatoriu — un garant, nu opțional). Se
rulează și când utilizatorul scrie „salvează memoria” sau „schimb contul”:
1. Rescrie complet „MEMORIE — stare curentă” cu stadiul real.
2. Adaugă o intrare nouă în `log.md`: dată/oră, ce s-a făcut, ce a rămas, atenționări.
3. Confirmă explicit că fișierele au fost scrise — nu presupune.

Reguli generale:
- Limba de lucru: română; termeni tehnici în engleză unde e cazul.
- Niciun secret (parole, chei, JWT secret) în cod, migrații sau documentație.

---

# MEMORIE — stare curentă

_Ultima actualizare: 2026-09-26 (branch `refresh/v2`, ne-unit cu main, nepush-uit)_

**Ce s-a făcut până acum:**
- v2 completă: Next.js 16 + Supabase (RLS, RPC, Realtime, Storage) + `ml_service` intern stateless + OSRM. API-ul Rust și modul demo au fost eliminate din arhitectură (vezi decisions.md).
- Schema: `supabase/sql/00–09` (00 = reset v1, 08 = seed demo opțional).
- K1–K12 implementate; expeditorul fără mașini postează cereri (`/requests`); desene noi de vehicule (`components/logistics/vehicle-drawing.ts`); editor de paleți K7 (`TruckCargo2D.tsx`).
- Teste verzi: vitest 20, SQL 38 de aserțiuni + atacuri, contract PostgREST 45 de verificări, pytest ml 15; build de producție OK.

**În lucru acum:**
- Plan în 2 părți (acum local / viitor): `PLAN_IMPLEMENTARE.md` — SURSA pentru ordinea pașilor.
- Utilizatorul pornește totul cu dublu-clic pe `OptiFleet.cmd` (start/stop/backup/status, PowerShell nativ; `bash` din PowerShell pornește WSL fără Docker!).
- Stack LOCAL funcțional pe laptop: `bash infra/local/setup.sh --demo` (doar din Git Bash) (Supabase self-hosted v0.8.2, Postgres 17, doar pe 127.0.0.1).
  Parole în `infra/local/.credentials` (gitignored). Frontend: `npm --prefix frontend run build && npx next start -p 3000` (sau dev).
- Test E2E cu browser real (playwright-core + Chrome) în scratchpad-ul sesiunii — NU e în repo; prima rulare a trecut
  login, hartă, căutare cu tranzit, panou vehicul, cerere de locuri, cerere nouă, constructor K6, plan K7, contracte, bursă.
  A doua rulare pică doar din date duplicate (DMO 123 / negociere existentă) → de făcut testul idempotent și mutat în repo (`e2e/`).
- Reparat azi: CSP permite ws:// doar pentru Supabase pe http; `upgrade-insecure-requests` doar pe https; harta pornește la zoom 7 (regiuni, K3);
  ETA în `search_trips` nu mai poate fi înaintea plecării (aplicat și pe baza locală).
- Containerele vechi v1 (proiect Docker `ptoirctlogistica`) au fost OPRITE (nu șterse) — ocupau portul 8000, Grafana admin/admin era expusă.

**Următorii pași (în ordine):**
1. E2E idempotent în repo + rulare curată; capturi pentru teză.
2. Scalare live: Realtime Broadcast pe celule, MapLibre GL + PMTiles Moldova local, poziții calde + istoric partiționat, simulator camioane + k6 (utilizatorul instalează k6 și `ollama pull bge-m3`).
3. UI pentru recenzii / preț coridor / drum de întoarcere / documente KYC (SQL deja în 10_trust_and_market.sql).
4. Worker AI local (Qwen3) cu rol Postgres `optifleet_worker` (fișier 11 neînceput).
5. Asistent hibrid Claude (utilizatorul alege modelul; are nevoie de cheie API).
6. Analiza pieței pentru teză + dosar grant ODA.

**Decizii de produs confirmate de utilizator (2026-09-26):**
- AI hibrid: Claude API (înțelegere + răspuns) → funcții SQL fixe (fără SQL generat de AI) → Qwen3 local (analiză, raport brut JSON) → Claude (răspuns). Anonimizare înainte de API, plafon de cost, fallback local.
- Șoferii NU au cont; doar firma. Verificarea telefonului se face la nivel de firmă (idee gratuită: bot Telegram / apel admin).
- Scalare pentru multe vehicule live: Realtime Broadcast pe celule geografice (nu postgres_changes), MapLibre GL (WebGL), poziții „calde” separate de istoric (tabel partiționat), agregate calculate pe server, test de încărcare k6.
- Disponibilitatea / datacenter / cluster GPU: amânate după etapa de produs.

**Note importante / capcane cunoscute:**
- Supabase folosește claim-ul JWT `role` ca rol Postgres; rolul aplicației stă în `profiles`/`platform_admins`, nu în JWT.
- Pe acest PC, Turbopack nu pornește (binarul SWC nativ e refuzat de Windows) → scripturile folosesc `--webpack`.
- Imaginea `supabase/postgres:15.8.1.085` are `auth.uid()` vechi (doar `request.jwt.claim.sub`); `api-contract.sh` îl înlocuiește ca în Cloud.
- Algoritmul de control IDNO (mod 11 din v1) NU e confirmat; se validează doar formatul (13 cifre). Verifică specificația ASP înainte de a adăuga checksum.
- Containerele vechi din v1 (proiect Docker `ptoirctlogistica`, ex. Prometheus pe 0.0.0.0:9090) încă rulau la 2026-09-26.
- Fișierele v1 rămase sunt stub-uri sau nefolosite; ESLint le ignoră temporar (`frontend/eslint.config.mjs`).
