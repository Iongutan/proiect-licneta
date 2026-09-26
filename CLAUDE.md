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

_Ultima actualizare: 2026-09-26 (branch `refresh/v2`, necomis pe main, nepush-uit)_

**Ce s-a făcut până acum:**
- v2 completă: Next.js 16 + Supabase (RLS, RPC, Realtime, Storage) + `ml_service` intern stateless + OSRM. API-ul Rust și modul demo au fost eliminate din arhitectură (vezi decisions.md).
- Schema: `supabase/sql/00–09` (00 = reset v1, 08 = seed demo opțional).
- K1–K12 implementate; expeditorul fără mașini postează cereri (`/requests`); desene noi de vehicule (`components/logistics/vehicle-drawing.ts`); editor de paleți K7 (`TruckCargo2D.tsx`).
- Teste verzi: vitest 20, SQL 38 de aserțiuni + atacuri, contract PostgREST 45 de verificări, pytest ml 15; build de producție OK.

**În lucru acum:**
- Nimic pornit. Așteaptă ca utilizatorul să ruleze SQL-ul în Supabase și să șteargă fișierele v1.

**Următorii pași:**
1. Utilizatorul: rulează `supabase/sql/00…09` în SQL Editor, setările Auth, creează adminul (MANUAL_DE_PORNIRE.md, pașii 1–3).
2. Utilizatorul: șterge fișierele din README → „Curățenie” (ștergerea a fost blocată pentru Claude).
3. Verificare vizuală a paginilor cu login pe datele reale (hartă, flotă, contracte), după migrații.
4. Posibile extensii: încărcarea licenței ANTA/CMR la KYC, export/ștergere cont (Legea 133), istoric GPS cu retenție, MSign.

**Note importante / capcane cunoscute:**
- Supabase folosește claim-ul JWT `role` ca rol Postgres; rolul aplicației stă în `profiles`/`platform_admins`, nu în JWT.
- Pe acest PC, Turbopack nu pornește (binarul SWC nativ e refuzat de Windows) → scripturile folosesc `--webpack`.
- Imaginea `supabase/postgres:15.8.1.085` are `auth.uid()` vechi (doar `request.jwt.claim.sub`); `api-contract.sh` îl înlocuiește ca în Cloud.
- Algoritmul de control IDNO (mod 11 din v1) NU e confirmat; se validează doar formatul (13 cifre). Verifică specificația ASP înainte de a adăuga checksum.
- Containerele vechi din v1 (proiect Docker `ptoirctlogistica`, ex. Prometheus pe 0.0.0.0:9090) încă rulau la 2026-09-26.
- Fișierele v1 rămase sunt stub-uri sau nefolosite; ESLint le ignoră temporar (`frontend/eslint.config.mjs`).
