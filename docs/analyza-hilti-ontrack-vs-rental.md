# Analýza: výpůjčka v Hilti ON!Track vs. náš Rental modul

> Porovnání, jak Hilti ON!Track řeší stejnou věc („výpůjčku") oproti našemu
> současnému modulu **Rental** (EPIC-10) v Tagery. Vstup: `MyTagie_funkcni_analyza_Hilti_ONTrack.md`.
> Kód porovnán se stavem na `main` (2026-08).

---

## 1. Hlavní závěr (TL;DR)

Náš Rental modul a Hilti ON!Track **řeší dva různé problémy, které jen sdílejí slovo „výpůjčka".**

| | Náš **Rental** (EPIC-10) | Hilti **ON!Track** |
|---|---|---|
| Otázka, na kterou modul odpovídá | „Může si tenhle **cizí člověk** věc půjčit a je ten obchod důvěryhodný?" | „**Kdo právě odpovídá** za tuhle věc a **kde je**?" |
| Mentální model | **Marketplace / půjčovna** (P2P, důvěra) | **Interní evidence majetku** (custody / odpovědnost) |
| Výpůjčka je… | **samostatný first-class koncept** (Loan) | **jeden typ obecného pohybu** (Movement `LOAN`) |
| Těžiště | ověření identity + reputace + cena/kauce | asset s digitální identitou + historie pohybů |

Klíčová myšlenka dokumentu je architektonická:

> **„Půjčeno" nemá být speciální výjimka. Má to být jeden typ obecného pohybu věci (Movement).**

To je hlubší a obecnější abstrakce než náš dnešní `Loan`.

---

## 2. Jak výpůjčku řešíme my (Rental modul, fakticky z kódu)

Entity (`apps/api/src/modules/rental/entities/`):

- **`RenterProfile`** – nájemce: `verification_level` (`none`/`contact`/`document`/`full_kyc`), `rating_avg`, `rating_count`, `status` (`active`/`blocked`).
- **`Item`** – půjčovaná věc: `name`, `serial_number`, `price_per_day`, `deposit`, `required_verification_level`. **Nemá pole `status`.**
- **`Loan`** – půjčka: `item_id`, `renter_profile_id`, `rental_start/end`, `status` (`pending_verification`/`active`/`returned`/`cancelled`).
- **`RentalReview`** – hodnocení, propisuje se do reputace nájemce (rolling average).

Workflow (`rental.service.ts`):

1. `createRenter` → `verify` (nastaví úroveň ověření)
2. `createItem` (s minimální požadovanou úrovní)
3. `createLoan` – **zkontroluje, že nájemce splňuje `required_verification_level`** (ADR-0005), jinak 400. Vždy vytvoří Loan se `status='active'`.
4. `submitReview` – hodnocení → reputace.

**Charakter:** vertikála pro **půjčovnu / P2P marketplace**. Jádrem je *důvěra mezi pronajímatelem a nájemcem* (ověření + reputace + kauce).

### Slabiny našeho modelu (upřímně)

- **Věc nemá stav** – `Item` nezná „dostupná / půjčená". Availability se nedá odvodit; při dvojí půjčce nic nebrání konfliktu.
- **Nekompletní životní cyklus** – enum `Loan.status` obsahuje `returned`/`cancelled`/`pending_verification`, ale **žádný endpoint je nenastavuje** (není `return`, `cancel`, prodloužení). Loan vznikne jako `active` a tam zůstane.
- **Žádná historie pohybů** – neexistuje audit/ledger „kde věc byla". Máme jen jednotlivé Loany + Reviews.
- **Žádné home/current umístění** ani řetězec odpovědnosti dál než „nájemce".
- **Stav se nastavuje ručně**, neodvozuje se z workflow.

---

## 3. Jak výpůjčku řeší ON!Track

Jádrem **není Loan, ale Movement/Transfer** nad **Asset** s vlastní digitální identitou:

- **Asset ≠ jeho umístění** – věc existuje samostatně, mění se jen *assignment* (přidělení).
- **Home ≠ Current** – systém ví, kam věc *patří* i kde právě *je*.
- **Předání je transakce**, ne přepsání pole `owner`. Typy pohybu: `ASSIGN`, `LOAN`, `MOVE`, `RETURN`, `HANDOVER`, `SERVICE_OUT/RETURN`, `DISPOSE`.
- **Stav se odvozuje z workflow** – `LOAN` → `status=LOANED`, `RETURN` → `AVAILABLE` (ne ruční pravda).
- **Historie se nepřepisuje**, přidávají se události → **nedotknutelný audit log**.
- **Inventura** porovnává DB s realitou: Found / Missing / Unexpected.

**Charakter:** **interní evidence majetku** (nářadí ve firmě) – accountability, dohledatelnost, ne marketplace. Půjčka je jen jeden z pohybů.

---

## 4. Co už Tagery UMÍ z vize ON!Track (a náš Rental modul to nevyužívá)

Zajímavé zjištění: **platformové jádro Tagery je k vizi ON!Track blíž než náš úzký Rental vertikál.**

| Princip ON!Track | Stav v Tagery |
|---|---|
| **Asset ≠ Tag/Identifier** (§5, §35) | ✅ **Máme přesně to** – `DigitalObject` ↔ `DataCarrier` (jeden objekt, víc nosičů QR/NFC/hybrid). Přesně oddělení „věc" vs „štítek". |
| Scan → Identify → Action (§6) | ~ částečně – resolver `/r/{code}` + module handler dispatch. Chybí „co s tím chceš udělat" menu. |
| Lidé bez účtu (§12) | ~ částečně – `Member` / `RenterProfile` jsou osoby bez loginu; ale nejednotné (backlog: sjednotit na `Party`/`Person`). |
| Location objekt (§13) | ~ máme `Location`, ale **plochou** (bez `parent_id` stromu). |
| RBAC + scope (§22) | ✅ `RolesGuard` + hierarchie rolí; scope-per-location zatím ne. |
| Audit log (§23) | ~ máme `ScanEvent`; ne obecný nedotknutelný ledger operací. |
| API-first (§21) | ✅ REST API, multi-tenant, webhooky (billing). |
| Dashboard „vyžaduje pozornost" (§29) | ~ máme analytics dashboard; ne action-oriented (po termínu, servis…). |

Rental modul přitom **nestaví na `DigitalObject`** – má vlastní `Item` bez nosiče. Tím obchází to nejsilnější, co platforma nabízí.

---

## 5. Mapování: kdyby se výpůjčka dělala „po ON!Track" v Tagery

| ON!Track koncept | Doporučené řešení v Tagery |
|---|---|
| Asset | **`DigitalObject`** (modul `asset`) + jeho `DataCarrier(y)` jako Tag |
| Tag (QR/NFC/BLE/Serial) | **`DataCarrier`** (už podporuje qr/nfc/hybrid; BLE/serial jako nový typ) |
| Person / Employee | sjednocený **`Party`/`Person`** (dnes Member/RenterProfile/User) |
| Location (strom) | **`Location` + `parent_id`** (rozšířit) |
| **Movement / Transfer** | **nová entita `Movement`** (`asset_id`, `type`, `from`, `to_type`+`to_id`, `due_at`, `actor`, `note`, `signature`) – append-only |
| Status věci | **odvozený** z posledního Movementu (ne ruční) |
| Loan | `Movement.type = LOAN` (náš dnešní Rental = jedna nadstavba nad tímto) |
| Home vs Current | `asset.home_location_id` + odvozený `current_*` z Movementu |
| Inventura | porovnání očekávaných assetů v lokaci vs. naskenovaných |
| Audit log | Movement ledger + `ScanEvent` |

---

## 6. Doporučení

1. **Nemíchat to.** Náš Rental = *marketplace/půjčovna* (důvěra, reputace, kauce). ON!Track model = *interní custody nářadí*. Jsou to **dvě různé vertikály** – obě legitimní.

2. **Pokud chceme cílit na „firemní evidence nářadí"** (ON!Track segment), nedělat to rozšiřováním Rental modulu, ale **novým modulem `asset` + obecnou entitou `Movement`** postavenou na `DigitalObject`/`DataCarrier`. Rental (P2P) může zůstat samostatná nadstavba.

3. **Rychlé výhry, které dávají smysl tak jako tak** (nezávisle na strategii):
   - Doplnit **`status` na půjčovanou věc** a **odvozovat ho z workflow**.
   - Dodělat **`return` / `cancel` / prodloužení** (životní cyklus Loanu je dnes neúplný).
   - **Location strom** (`parent_id`) – silná, levná funkce (sken regálu → přesun položek).
   - **Movement ledger** i pro Rental → získáme historii a audit „zdarma".

4. **Positioning** (§34) sedí s tím, kam Tagery míří: *„každá fyzická věc dostane digitální identitu"* – to je přesně `DigitalObject` + nosič, ne „aplikace na půjčování".

### Jednou větou

> Hilti řeší výpůjčku jako **jeden pohyb v ledgeru odpovědnosti za majetek**; my ji dnes řešíme jako **samostatnou důvěryhodnostní transakci na marketplace**. Chceme-li Hilti segment, přidejme obecný **Movement nad DigitalObject** – ne rozšiřujme Rental.
