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

_Ultima actualizare: 2026-09-26_

**Ce s-a făcut până acum:**
- Audit complet al codului (2026-09-26) — rezultatul e în `proiect-memorie/memory/log.md`.

**În lucru acum:**
- Refacere totală: securitate, flotă + paleți + imagini vehicule, fluxul
  expeditorului fără mașini (postare comandă), curățare fișiere inutile.

**Următorii pași:**
1. Vezi ultima intrare din `log.md`.

**Note importante / capcane cunoscute:**
- Repo-ul e pe GitHub (`Iongutan/proiect-licneta`); parolele conturilor demo
  au fost în git (`009_create_default_admin.sql`, pagina de login) → trebuie
  schimbate în Supabase.
- Supabase folosește claim-ul JWT `role` ca rol Postgres — rolul aplicației
  NU are voie să-l suprascrie (folosește `app_role`).
