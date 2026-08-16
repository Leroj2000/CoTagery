# Co dál: roadmapa Asset + Movement (na základě analýzy Hilti ON!Track v2)

> Konkrétní prioritizovaný plán, jak rozšířit Tagery směrem k vizi „každá věc má
> digitální identitu". Zakotveno v aktuálním kódu na `main`. Vstup:
> `MyTagie_funkcni_analyza_Hilti_ONTrack_v2.md` (kap. 1–43).
> Navazuje na `docs/analyza-hilti-ontrack-vs-rental.md`.

## Co je nového ve v2 (oproti v1)

Datový model (kap. 1–37) je stejný. Nové jsou kapitoly **38–43 = UX/obrazovky**:

- **Web = správa a dohled, mobil = fyzická práce s věcí** (§41). Nezrcadlit 1:1.
- Web IA: **Dashboard · Věci · Lidé · Místa · Pohyby · Inventury · Požadavky · Servis · Upozornění · Reporty · Nastavení**.
- Mobil: **SCAN je dominantní CTA**; logika „nejdřív věc → pak kontextová akce" (§39.1).
- **Movement Ledger** dostupný globálně i na assetu/člověku/lokaci (§38.26).
- Tři oddělené údaje: **patří do / aktuálně je / má ji** – nesmí splynout do jednoho `location_id` (§39.5).
- **Stav se odvozuje z událostí**, ne ručně (§39.4) – *tohle už u Rentalu máme*.
- **Alerty jako úkoly** (action-oriented), ne „notification graveyard" (§38.19, §38.27).
- **Person ≠ User Account** (§38.28).
- Discrepancy center „evidence říká X, realita Y" (§11, §38.15).

## Kde stojíme (co už z vize máme)

| Princip ON!Track | Stav v Tagery |
|---|---|
| Asset ≠ Tag | ✅ `DigitalObject` ↔ `DataCarrier` (QR/NFC/hybrid) |
| Stav z workflow | ✅ **hotovo pro Rental** (item available/loaned, return/cancel) |
| Scan → akce | ~ resolver `/r/{code}` + handlery (chybí „co s tím chceš dělat") |
| Lidé | ~ Member/RenterProfile/User (nejednotné → `Party/Person`) |
| Lokace | ~ `Location` **plochá** (chybí `parent_id`) |
| RBAC | ✅ RolesGuard (chybí scope per-lokace) |
| Audit | ~ `ScanEvent` (chybí obecný Movement ledger) |
| Dashboard | ✅ analytics (chybí „vyžaduje pozornost") |
| API-first, multi-tenant | ✅ |

Závěr: **jádro platformy je vizi blízko; chybí horizontální „asset custody" vrstva.**

---

## Doporučená roadmapa (prioritně)

### 🟢 Fáze A — Asset + Movement core (největší páka, „srdce")

Dělat jako **nový modul `asset`** nad `DigitalObject`, ne rozšířením Rentalu.

1. **`module_type = 'asset'`** – Asset je záznam modulu navázaný na DigitalObject (jako Product/Membership). Nese: kategorie, výrobce, model, sériové číslo, `home_location_id`, `status` (odvozený), `current_holder_type`+`current_holder_id` (person/location/asset), `responsible_person_id`, `due_at`.
2. **`Movement`** – append-only ledger: `asset_id`, `type` (ASSIGN/LOAN/MOVE/RETURN/HANDOVER/SERVICE_OUT/SERVICE_RETURN/DISPOSE), `from_{type,id}`, `to_{type,id}`, `actor_person_id`, `due_at`, `note`, `created_at`. **Nikdy se needituje** (oprava = nová událost).
3. **Odvozený stav + current holder** – service `performMovement()` přidá Movement a přepočítá `status`/`current_*` (stejný princip jako u Rentalu, jen obecně). Stavy: AVAILABLE/ASSIGNED/LOANED/IN_TRANSFER/RESERVED/SERVICE/DAMAGED/LOST/RETIRED.
4. **Location tree** – `Location.parent_id` (stromová hierarchie, každý uzel může mít nosič/QR).
5. **Historie** – `GET /assets/:id/movements` + globální ledger.

*Výsledek:* výpůjčka = `Movement type=LOAN`; přesun, předání, servis atd. „zdarma" ve stejném modelu. Audit a historie vzniknou samy.

### 🟡 Fáze B — UX kolem toho (aby to bylo použitelné)

6. **Scan → kontextové akce** – `/r/{code}` u assetu vrátí stav + nabídku akcí dle stavu/oprávnění (Půjčit/Vrátit/Předat/Servis/Detail).
7. **Admin obrazovky** – Věci (list se stavem/kde/kdo), detail s historií, Místa (strom), Pohyby (ledger).
8. **„Vyžaduje pozornost"** – po termínu, nepotvrzená předání, nesrovnalosti → každý řádek s akcí (Vyřešit).
9. **Person vs Account** – sjednotit Member/RenterProfile na `Party/Person` (backlog), oddělit od User účtu.

### 🔵 Fáze C — pokročilé (až po ověření)

10. Inventura (Found/Missing/Unexpected), Requests/Rezervace, Servis/revize (datový model připravit dřív), asset nesting (`parent_asset_id`), potvrzení převzetí (4 režimy), Transfer Cart („Výdej"), offline sync + konflikty, API keys/webhooky, CSV import/export.

---

## Doporučení jedním odstavcem

Postavit **Fázi A (Asset + Movement + Location tree)** jako nový modul nad
`DigitalObject`. Je to „architektonické srdce" (dokument §37 varuje, že chyby v
téhle části se opravují nejhůř), odemkne to většinu ostatních funkcí a přesně
navazuje na to, co jsme právě udělali u Rentalu (odvozený stav). Rental (P2P
marketplace) zůstává samostatná nadstavba. Doporučený první krok:
**datový model + stavový automat Asset/Movement**, pak teprve obrazovky.
