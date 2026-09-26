# OptiFleet B2B — Securitate și protecția datelor cu caracter personal

Documentul descrie mecanismele **implementate efectiv** în v2 și unde se află în cod. Ce nu e implementat e marcat explicit ca extensie.

## 1. Modelul de amenințări, pe scurt

| Amenințare | Protecție | Unde |
|---|---|---|
| O firmă citește sau modifică datele alteia | Row Level Security pe toate tabelele; identitatea vine din `auth.uid()` → `profiles` | `04_rls_and_grants.sql` |
| Clientul își acordă singur KYC, capacitate sau stare | drepturi **pe coloane** (`grant update (coloane)`); stările se schimbă doar prin RPC | `04_…`, `05_business_rpc.sql` |
| Escaladare de rol prin JWT | rolul aplicației **nu** stă în JWT; se citește din `profiles` / `platform_admins` | `03_functions_core.sql` |
| Suprarezervarea unui camion (condiție de cursă) | `SELECT … FOR UPDATE` pe rândul vehiculului + constrângeri `CHECK` | `_reserve_capacity()` |
| Deturnarea funcțiilor `SECURITY DEFINER` | `search_path` fix; `CREATE` pe `public` revocat; `EXECUTE` acordat explicit, funcție cu funcție | `01_…`, `05_…` |
| Jurnal falsificat sau șters | `audit_log` fără drept de INSERT/UPDATE/DELETE pentru clienți; scriere doar prin `log_audit()` | `02_…`, `04_…` |
| XSS | CSP cu nonce per request, `strict-dynamic`; markerii de hartă sunt construiți din text escapat și SVG numeric, fără `onclick` inline | `proxy.ts`, `RealMoldovaMap.tsx`, `vehicle-drawing.ts` |
| Clickjacking | `frame-ancestors 'none'` + `X-Frame-Options: DENY` | `proxy.ts`, `next.config.ts` |
| Furt de sesiune | cookie-uri gestionate de `@supabase/ssr`; JWT verificat criptografic cu `getClaims()` (chei asimetrice / JWKS) la fiecare request | `proxy.ts`, `supabase-server.ts` |
| Open redirect după login | `safeNextPath()` acceptă doar căi interne | `safe-redirect.ts` |
| Abuz de servicii costisitoare (OSRM, ML) | rute API autentificate + limită de rată + limite de mărime pe intrări | `api-guard.ts`, `ml_service/optifleet_ml/config.py` |
| Scurgerea cheii secrete Supabase | frontend-ul folosește doar cheia *publishable* și refuză să pornească cu cea secretă; `ml_service` nu primește nicio cheie Supabase | `lib/env.ts` |
| Acces direct la serviciile interne | porturi legate de `127.0.0.1`; `ml_service` cere un token Bearer comparat în timp constant; containere `read_only`, `cap_drop: ALL`, `no-new-privileges` | `docker-compose.yml`, `security.py` |
| Tokenuri GPS furate din baza de date | se stochează doar SHA-256; tokenul (256 de biți) apare o singură dată; o poziție la maximum 5 s | `issue_device_token()`, `ingest_position()` |
| Poze de livrare publice | bucket privat, citire doar de părțile rezervării, prin URL-uri semnate de 5 minute; fără drept de ștergere sau înlocuire | `06_storage_realtime.sql` |
| Parole slabe sau publicate | fără parole în cod sau migrații; minim 10 caractere (+ „leaked password protection” în Supabase); conturile v1 cu parole publicate sunt șterse de `00_reset` | `register/page.tsx`, `MANUAL_DE_PORNIRE.md` |

Toate aceste reguli sunt verificate automat de `supabase/tests/run.sh` și `supabase/tests/api-contract.sh`, prin încercări de atac care trebuie să eșueze: firmă terță care citește rezervări sau poze, client care își setează KYC-ul, suprarezervare simultană, calea B fără exonerare, token GPS greșit.

## 2. Matricea de acces

| Date | Firma proprie | Alte firme verificate | Contrapartea unui contract | Admin platformă |
|---|---|---|---|---|
| Companie (nume, IDNO, adresă) | citire + editare câmpuri de contact | citire | citire | citire + KYC |
| Vehicule listate, locuri libere, poziție | tot | citire (bursa) | citire | citire |
| Șofer și telefon (`vehicle_private`) | tot | — | citire, doar cât contractul e activ | — |
| Cereri de transport | tot | transportatorii verificați văd cererile deschise | citire | citire |
| Rezervări, mesaje, contracte | ca parte | — | ca parte | citire |
| Poze de livrare | ca parte | — | ca parte | — |
| Jurnal de audit | evenimentele proprii | — | — | tot |

## 3. Contracte (K9) — ce garantează tehnic

- **Calea A**: `choose_contract_path('PLATFORM')` construiește în baza de date un instantaneu JSON cu datele legale ale ambelor firme (denumire, formă juridică, IDNO, adresă), vehiculul, marfa, traseul, prețul și clauzele. Calculează apoi `SHA-256` peste instantaneu. Fiecare semnătură înregistrează utilizatorul, ora serverului și hash-ul. La semnare, hash-ul se recalculează, iar orice modificare blochează semnarea. Un preț nou anulează contractul și semnăturile.
- **Calea B**: nu poate fi aleasă și nici confirmată fără acceptarea explicită a textului „Platforma NU își asumă răspunderea…”, cerută atât în interfață (bifă + buton), cât și în baza de date (`p_disclaimer_accepted` + constrângerea `bookings_direct_needs_disclaimer`). Fiecare acceptare apare în jurnal, cu ora exactă.
- **Limita juridică**: e o acceptare electronică cu amprentă criptografică, legată de o sesiune autentificată, nu o semnătură electronică calificată. **Extensie**: integrarea MSign pentru contractele de valoare mare (Legea nr. 124/2022 privind identificarea electronică și serviciile de încredere).

## 4. Cadrul legal

### Legea nr. 133/2011 privind protecția datelor cu caracter personal
| Principiu | Cum se aplică |
|---|---|
| Legalitate | prelucrare pentru executarea contractelor B2B, cu consimțământ explicit la înregistrare |
| Limitarea scopului | datele șoferului (nume, telefon) sunt vizibile doar contrapărții unui contract activ |
| Minimizare | nu se colectează IDNP, date bancare sau documente personale; pentru firmă doar datele necesare contractului |
| Exactitate | IDNO validat ca format la înregistrare; existența în Registrul de stat o verifică administratorul (KYC) |
| Securitate | TLS (HTTPS, HSTS), parole hash-uite de Supabase Auth (bcrypt), RLS, jurnal de audit |

**Datele GPS**: poziția aparține vehiculului firmei. Șoferul trebuie informat de transportator că vehiculul e monitorizat. Vehiculele nelistate (`is_listed = false`) nu apar în bursă, ci doar la proprietar și la contrapartea unui contract activ.

**Extensii recomandate**:
- export și ștergere a contului la cerere (dreptul de acces și de ștergere);
- o politică de retenție pentru istoricul pozițiilor GPS. Acum se păstrează doar ultima poziție, nu un istoric.

### Codul transporturilor rutiere nr. 150/2014 și licențierea ANTA
Transportul de mărfuri contra cost îl pot face doar operatorii licențiați. În v2 verificarea e **manuală**: administratorul aprobă firma (KYC) înainte ca aceasta să apară în bursă sau să poată rezerva, iar vehiculele firmelor neverificate nu sunt vizibile altora. **Extensie**: încărcarea licenței ANTA și a poliței CMR, cu dată de expirare verificată automat.

### GDPR (Regulamentul UE 2016/679)
Pentru partenerii din UE, principiile de mai sus urmează „privacy by design / by default”: acces implicit minim și date sensibile separate în tabele cu acces restrâns.

## 5. Operare sigură

- Cheia secretă Supabase (`sb_secret_…`) nu e necesară aplicației. Nu o pune în `frontend/.env.local` și nici în `ml_service/.env`.
- Schimbă `INTERNAL_API_TOKEN` / `ML_SERVICE_TOKEN` dacă au fost vreodată partajate.
- Repo-ul a conținut în v1 parolele conturilor demo. `00_reset_old_schema.sql` șterge acele conturi; nu le recrea cu aceleași parole.
- `npm audit --omit=dev` raportează 0 vulnerabilități la data refacerii (2026-09-26).
