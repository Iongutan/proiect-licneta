# OptiFleet B2B — Audit de Securitate + Plan de Scalare la 1.000.000 Utilizatori

## PARTEA 1: Vulnerabilități găsite, în ordine de severitate

---

### CRITIC — Fallback nesigur pe cheia JWT (Rust, api/src/middleware/auth.rs)

**Problema:** dacă `SECRET_KEY` sau `SUPABASE_JWT_SECRET` lipsesc din mediu,
sistemul cade pe literalul `"secret"` — oricine poate forja token-uri
valide, pentru orice rol, inclusiv SUPER_ADMIN.

```
PROMPT J1 — Elimină fallback-ul nesigur pe cheia JWT

În api/src/middleware/auth.rs, elimină complet .unwrap_or_else(|_| "secret".into()).

Înlocuiește cu: dacă SECRET_KEY (sau SUPABASE_JWT_SECRET) lipsește din mediu,
serverul trebuie să REFUZE PORNIREA COMPLET (panic controlat la startup, cu
mesaj clar de eroare), nu să pornească silențios cu o cheie implicită.

Adaugă și o validare de lungime minimă (minim 32 caractere, conform
recomandării deja prezente în .env.example) - respinge la pornire dacă
secretul e prea scurt/slab.

Aplică aceeași regulă (fail-fast la pornire, fără fallback) și verifică
că Python (ml_service) are deja acest comportament corect (SECRET_KEY e
deja obligatoriu în Settings, fără valoare implicită - confirmă asta,
nu modifica dacă e deja corect).

Scrie un test care confirmă: pornirea serverului Rust fără SECRET_KEY setat
eșuează explicit, nu pornește cu o cheie implicită.
```

---

### RIDICAT — CORS complet deschis în producție

**Problema:** `allow_origin(Any)` permite oricărui site să facă cereri
către API din browserul unui utilizator autentificat.

```
PROMPT J2 — Restricționează CORS pe baza mediului

În api/src/main.rs, înlocuiește CorsLayer::new().allow_origin(Any) cu o
configurare condiționată de ENVIRONMENT:

- development: permite localhost:3000 (origin explicit, nu Any)
- production: citește o listă de origini permise dintr-o variabilă de
  mediu (CORS_ALLOWED_ORIGINS, listă separată prin virgulă), nu Any

Elimină și allow_headers(Any)/allow_methods(Any) - specifică explicit
metodele (GET, POST, PUT, DELETE, OPTIONS) și header-ele necesare
(Authorization, Content-Type).

Scrie un test care confirmă: o cerere de la un origin nepermis (ex.
https://site-rau-intentionat.com) primește o respingere CORS explicită
în mediul de producție.
```

---

### MEDIU — Rate limiting poate fi ocolit prin falsificare de header

```
PROMPT J3 — Rate limiting sigur, doar prin proxy de încredere

În api/src/middleware/rate_limit.rs, funcția get_identifier() are
încredere necondiționată în X-Forwarded-For/X-Real-IP, falsificabile de
client dacă cererea nu vine printr-un proxy de încredere.

Configurează explicit Nginx (nginx.conf) să SUPRASCRIE (nu doar adauge)
header-ul X-Forwarded-For cu adresa IP reală a conexiunii, înainte de a
trimite cererea către api. Documentează explicit în cod (comentariu) că
get_identifier() are încredere în acest header DOAR pentru că Nginx îl
garantează - dacă cineva elimină vreodată Nginx din arhitectură, acest
mecanism devine nesigur.

Pentru utilizatori autentificați, preferă identificarea prin user_id din
JWT (deja disponibil în Claims) în locul IP-ului, ca limitare mai precisă
și imposibil de falsificat.
```

---

### MEDIU — Token JWT stocat în localStorage (risc XSS)

```
PROMPT J4 — Migrează la cookie httpOnly pentru refresh token

Păstrează access token-ul (durată scurtă, 15 minute deja configurat) în
memorie (variabilă JS, nu localStorage) - se pierde la refresh de pagină,
dar asta e acceptabil dat fiind durata scurtă.

Mută refresh token-ul (durată lungă, 7 zile) într-un cookie httpOnly,
secure, sameSite=strict, setat direct de server (Rust API), inaccesibil
din JavaScript - previne furtul prin XSS.

Actualizează api-client.ts să nu mai scrie tokenul în localStorage;
implementează reînnoirea automată a access token-ului folosind cookie-ul
httpOnly (endpoint /auth/refresh, apelat automat când access token-ul
expiră).

Scrie un test care confirmă: refresh token-ul nu e accesibil prin
document.cookie sau localStorage din JavaScript de pe pagină.
```

---

### DE LUAT ÎN CONSIDERARE — Rate limiter "fail open"

Design deja documentat explicit în cod (comentariu: „În producție poți
schimba în fail closed") — nu e o eroare ascunsă, dar merită o decizie
explicită înainte de lansare: la 1.000.000 utilizatori, dacă Redis pică,
"fail open" înseamnă zero protecție anti-abuz exact când sistemul e deja
sub presiune. Recomand "fail closed" parțial: permite cereri esențiale
(login, health check), blochează restul, până Redis revine.

---

## PARTEA 2: Plan de scalare la 1.000.000 de utilizatori

### Ce ai deja bine poziționat pentru scară mare

- **Rust/Axum pentru API gateway** — alegere corectă, confirmată chiar în
  comentariile proiectului („1M+ conexiuni concurente, doar ~2GB RAM") —
  arhitectura async e potrivită exact pentru acest volum
- **Separare pe servicii** (api / ml_service / osrm / redis) — permite
  scalare independentă a fiecărei piese, nu totul ca un monolit
- **Docker Compose cu `--scale api=N`** — deja pregătit pentru replicare
  orizontală a stratului API

### Ce lipsește pentru 1.000.000 de utilizatori reali

```
PROMPT J5 — Coadă de sarcini pentru calcule grele (clustering, VRP)

Clustering-ul DBSCAN și optimizarea CVRP (OR-Tools) sunt operații
CPU-intensive care, apelate direct sincron din API, blochează workerul
și limitează throughput-ul la volum mare de cereri simultane.

Introdu o coadă de sarcini (Celery cu Redis ca broker, sau RQ - Redis
Queue, mai simplu) pentru ml_service: cererile de clustering/optimizare
se pun în coadă, procesate de workeri separați, scalabili independent de
API-ul principal (ex. docker compose up --scale ml_worker=8 în perioade
de vârf).

Rezultatul se întoarce fie prin polling (frontend verifică status
periodic), fie prin WebSocket (notificare când rezultatul e gata) -
infrastructura de WebSocket există deja în proiect, reutilizeaz-o.
```

```
PROMPT J6 — Bază de date pregătită pentru scară: connection pooling + replici de citire

La 1.000.000 utilizatori, o singură conexiune directă la Postgres prin
Supabase nu ține pasul cu volumul de cereri simultane.

Configurează PgBouncer (connection pooling) între API și Postgres, ca să
gestioneze eficient mii de conexiuni concurente fără să epuizezi limita
nativă de conexiuni Postgres.

Introdu replici de citire (read replicas) pentru interogările de tip
SELECT (ex. căutare clustere, listare comenzi) - separă traficul de
citire (majoritar) de cel de scriere (minoritar), pe conexiuni diferite.

Verifică și adaugă explicit indecși spațiali GIST pe coloanele GEOMETRY
(location, pickup_loc, dropoff_loc, route_geometry) în migrările
PostgreSQL/PostGIS - fără ei, interogările spațiale (KNN, clustering)
devin extrem de lente la volum mare de date.
```

```
PROMPT J7 — Redis: clustering și replicare, nu instanță unică

Instanța Redis actuală (single node, docker-compose) e un punct unic de
eșec - dacă pică, cad simultan: cache-ul, rate limiting-ul, și pub/sub
pentru WebSocket live tracking.

Migrează la Redis Cluster (auto-partiționare, replicare automată) sau la
un serviciu Redis gestionat (Upstash, AWS ElastiCache) cu replicare
activă - la 1M utilizatori, indisponibilitatea Redis nu trebuie să
oprească toată platforma.
```

```
PROMPT J8 — OSRM: replici multiple în spatele unui load balancer

O singură instanță OSRM devine bottleneck la volum mare de calcule de
rută simultane.

Rulează mai multe instanțe OSRM (read-only, ușor de replicat - datele de
rutare nu se schimbă des), în spatele Nginx sau a unui load balancer
dedicat, cu distribuire round-robin a cererilor.
```

```
PROMPT J9 — Observabilitate: metrici, logging centralizat, alertare

Proiectul are healthcheck-uri de bază, dar nu are infrastructură de
monitorizare pentru producție la scară.

Adaugă:
- Prometheus + Grafana (sau echivalent gestionat) pentru metrici (latență
  per endpoint, rată de erori, utilizare CPU/memorie per serviciu)
- Logging centralizat (ex. Loki, sau serviciu cloud) - cu 1M utilizatori,
  logurile per container individual devin imposibil de urmărit manual
- Alertare automată (ex. Grafana Alerting) pentru: rată de erori 5xx
  peste prag, latență API peste prag, Redis/Postgres indisponibile

Fără asta, o problemă la scară mare se observă abia când utilizatorii
reclamă, nu proactiv.
```

```
PROMPT J10 — WebSocket la scară: fan-out prin Redis Pub/Sub, nu conexiuni directe

Confirmă că WebSocket handler-ul (api/src/handlers/websocket.rs) publică
actualizările de poziție GPS prin Redis Pub/Sub (nu ține toate conexiunile
WebSocket pe un singur proces) - asta permite ca orice instanță API
(dintre cele N replicate) să primească și să retransmită actualizări,
indiferent pe care instanță s-a conectat inițial clientul.

Dacă nu e deja implementat astfel, refactorizează pentru acest tipar -
esențial pentru ca scalarea orizontală a API-ului (Prompt existent,
--scale api=N) să funcționeze corect și pentru WebSocket, nu doar pentru
cereri HTTP obișnuite.
```

### Ordinea recomandată de aplicare

1. **J1, J2** — critic, de aplicat ÎNAINTE de orice lansare publică, chiar și demo
2. **J3, J4** — securitate, de aplicat înainte de utilizatori reali
3. **J5, J6, J7, J8** — scalare, de aplicat pe măsură ce crește traficul real, nu neapărat toate deodată de la început
4. **J9** — cât mai devreme posibil, ca să vezi problemele înainte să crească
5. **J10** — verifică acum, dacă nu e deja corect implementat, e mai ușor de reparat devreme decât după ce ai mii de conexiuni live
