# EPIC-23-VEHICLE-LOGBOOK – Kniha jízd vozidel

## Stav: ⬜ ZADÁNO (2026-10-15) · ke zpracování v budoucnu

## Cíl
Ke každému vozidlu (položka v kategorii s `equipment_kind = 'vehicle'`) vede firma **knihu
jízd**: kdy, kdo, odkud kam, proč (služební / soukromá), stav tachometru na začátku a na konci
a volitelně tankování (litry, cena, účtenka). Kniha jízd:
- **navazuje na stávající evidenci tachometru** (`asset_meter_readings`) – každá jízda je
  zároveň odečtem, takže servisní intervaly, inventura vozidel i „ujeto od pořízení" fungují
  dál beze změny a bez dvojího zadávání,
- je **použitelná jako podklad pro daně** (ZDP §24 – výdaje na vozidlo, náhrady za PHM,
  soukromé užití služebního vozu §6 odst. 6; DPH – nárok na odpočet poměrem) – viz §8,
- je rychlá na mobilu: sken QR na vozidle → „Začít jízdu" → po návratu „Ukončit jízdu".

Mimo rozsah v1: automatické GPS sledování (OBD/telematika), výpočet cestovních náhrad
zaměstnancům (jen export podkladů), schvalovací workflow jízd.

## Výchozí stav – co už existuje (stavíme na tom)
| Co | Kde | Využití v knize jízd |
|---|---|---|
| Druh vybavení `vehicle` (km, celá čísla) | `asset_categories.equipment_kind`, `maintenance.logic.ts` | určuje, které položky mají knihu jízd |
| Odečty tachometru | `asset_meter_readings` (`value numeric(12,1)`, `observed_at`, měkké mazání `deleted_at`) + `MaintenanceService.addReading/deleteReading` | jízda zapisuje odečty; stejná validace monotónnosti |
| Validace odečtu | `addReading`: km celé číslo, ne nižší než poslední odečet ani než poslední servisní `meter_value` | sdílená funkce pro jízdy (viz §3) |
| Servisní intervaly | `asset_maintenance_rules`, `asset_services.meter_value`, `GET /maintenance/due` | po jízdě se automaticky přepočte „servis za X km" |
| Inventura vozidel + ujeto | `vehicle-inventory.logic.ts` (`periodReadings`, `previousReading`, `odometerAtPurchase`, `kmDiff`) – commit 6158f46 | km za období se dají porovnat se součtem jízd (kontrola úplnosti knihy) |
| SPZ | `assets.registration_plate` | hlavička knihy jízd, export |
| Pořízení | `asset_purchases` (`purchased_on`, `condition`) | počátek knihy, stav km při pořízení |
| Osoby = uživatelé | `people.user_id` (MemberPeople), výdej/výpůjčka vozidla (`asset_movements`) | řidič = osoba; předvyplnění podle toho, kdo má vozidlo vydané |
| Rezervace | `reservations` (`from_at`, `to_at`, `requested_by_id`) | jízdu lze založit z rezervace; účel/řidič předvyplněn |
| Kalendář | `modules/calendar` (větev `feature/calendar`, nasazeno, **zatím nemergováno do main**) | nový zdroj `trip` v kalendáři (F3) |
| Modul `vehicles` | `@RequireModule('vehicles')` na maintenance API | kniha jízd je součástí stejného modulu |

## Datový model

### `vehicle_trips` (RLS, tenant_id)
| Sloupec | Typ | Pozn. |
|---|---|---|
| `id`, `tenant_id`, `created_at`, `updated_at` | | `BaseTenantEntity` |
| `asset_id` | uuid FK `assets` | jen vozidlo (kontrola v service) |
| `driver_person_id` | uuid FK `people` | řidič (osoba; u člena firmy propojená s uživatelem) |
| `started_at` / `ended_at` | timestamptz | `ended_at NULL` = jízda probíhá |
| `start_reading_id` / `end_reading_id` | uuid FK `asset_meter_readings` | **odečty tachometru jízdy** (zdroj pravdy pro km) |
| `start_km` / `end_km` | numeric(12,1) | denormalizovaná kopie pro rychlé výpisy a export |
| `distance_km` | numeric(12,1) GENERATED (`end_km - start_km`) | |
| `purpose` | text CHECK (`business`,`private`) | služební / soukromá |
| `route_from`, `route_to`, `route_via` | text | odkud, kam, (přes) – volný text, později našeptávání z míst |
| `description` | text | účel cesty (např. „jednání u zákazníka X") – vyžadováno u služebních |
| `reservation_id` | uuid NULL FK `reservations` | jízda podle rezervace |
| `status` | text CHECK (`open`,`closed`,`void`) | `void` = stornovaná (neodstraňuje se, viz audit) |
| `created_by`, `closed_by` | uuid | uživatelé |
| `locked_at` | timestamptz NULL | uzamčeno uzávěrkou měsíce (§8) |

Indexy: `(tenant_id, asset_id, started_at DESC)`, `(tenant_id, driver_person_id, started_at)`,
unikát „max. jedna otevřená jízda na vozidlo": `UNIQUE (tenant_id, asset_id) WHERE status='open'`.
CHECK `ended_at IS NULL OR ended_at >= started_at`, `end_km IS NULL OR end_km >= start_km`.

### `vehicle_fuel_entries` (RLS, tenant_id)
`id`, `tenant_id`, `asset_id`, `trip_id NULL`, `fueled_at`, `liters numeric(8,2)`,
`price_total numeric(12,2)`, `currency` (default CZK), `fuel_type` (`petrol`,`diesel`,`lpg`,
`cng`,`electric_kwh`,`adblue`), `odometer_km NULL` (volitelný odečet – zapíše se i do
`asset_meter_readings`), `receipt_media_id NULL` (FK na stávající `asset_media` / úložiště
fotek), `paid_by` (`company_card`,`driver`,`other`), `note`.
Tankování může existovat i bez jízdy (natankováno na parkovišti).

### Vazba na `asset_meter_readings` (klíčové rozhodnutí)
- **Odečty zůstávají jediným zdrojem stavu tachometru.** Jízda při startu/ukončení zakládá
  odečet přes sdílenou funkci (refaktor `MaintenanceService.addReading` na
  `MeterReadingsService.record(assetId, value, observedAt, source)`), takže platí stejná
  validace (celá km, monotónnost, ≥ poslední servisní odečet).
- `asset_meter_readings` dostane sloupce `source text` (`manual`,`trip_start`,`trip_end`,
  `fuel`,`service`,`inventory`) a `source_id uuid NULL` – v detailu vozidla je vidět, odkud
  odečet je, a smazání odečtu navázaného na jízdu je zakázané (maže/opravuje se jízda).
- **Kontinuita:** `start_km` nové jízdy se předvyplní posledním odečtem. Pokud je vyšší
  (mezera), UI zobrazí upozornění „neevidováno X km" a nabídne doplnit jízdu; v přehledu
  měsíce se mezery počítají jako **nezapsané km** (pro daňovou průkaznost).
  Nižší hodnota je chyba (stejně jako dnes u odečtů).
- **Zpětné zápisy:** jízda vložená do minulosti musí sedět mezi sousední odečty
  (`prev.value ≤ start_km ≤ end_km ≤ next.value`) – nová čistá funkce
  `validateTripAgainstReadings()` v `vehicle-trips.logic.ts` (unit testy jako u
  `vehicle-inventory.logic`).
- **Kontrola úplnosti:** km za období z odečtů (`periodReadings` + `kmDiff`) vs. součet
  `distance_km` jízd → rozdíl = nezapsané km. Ukáže se v inventuře vozidel a v měsíčním
  přehledu knihy jízd.

## API (`/api/v1`, modul `vehicles`)
| Metoda | Cesta | Oprávnění | Popis |
|---|---|---|---|
| GET | `/vehicles/:assetId/trips?from&to` | `vehicle.trip.view` (vlastní jízdy: `vehicle.trip.create`) | kniha jízd vozidla |
| GET | `/vehicles/trips?from&to&driver&purpose` | `vehicle.trip.view` | přehled přes všechna vozidla |
| POST | `/vehicles/:assetId/trips/start` | `vehicle.trip.create` | začít jízdu (`startKm`, řidič, účel, odkud) |
| POST | `/vehicles/trips/:id/finish` | `vehicle.trip.create` (jen vlastní/otevřená) | ukončit (`endKm`, kam, popis) |
| POST | `/vehicles/:assetId/trips` | `vehicle.trip.create` | zpětný zápis celé jízdy |
| PATCH | `/vehicles/trips/:id` | `vehicle.trip.update` (vlastní do uzávěrky) | oprava, audit před/po |
| POST | `/vehicles/trips/:id/void` | `vehicle.trip.delete` | storno (žádné fyzické mazání) |
| GET/POST | `/vehicles/:assetId/fuel` | `vehicle.fuel.view` / `vehicle.fuel.create` | tankování |
| GET | `/vehicles/:assetId/logbook/summary?month=YYYY-MM` | `vehicle.trip.view` | km služebně/soukromě, nezapsané km, PHM, spotřeba l/100 km |
| POST | `/vehicles/logbook/close?month=YYYY-MM` | `vehicle.trip.manage` | uzávěrka měsíce (zamkne jízdy) |
| GET | `/exports/vehicle-logbook?assetId&from&to&format=xlsx\|pdf` | `vehicle.trip.export` | export (stávající `ExportDefinitions` / exceljs, pdfkit) |

Validace v DTO (class-validator) + doménová logika v `*.logic.ts`; všechny zápisy přes
`runInTenant` a s auditem (`PolicyAndAudit`).

## UI (web, Next.js – admin + mobil)
- **Detail vozidla → záložka „Kniha jízd"**: tabulka jízd (datum, řidič, odkud–kam, účel,
  km od–do, ujeto, služební/soukromá), filtr měsíce, souhrn měsíce, tlačítko Export.
- **Rychlá jízda (mobil)**: po skenu QR vozidla (`/admin/scan`, „Moje vybavení") tlačítka
  **Začít jízdu** / **Ukončit jízdu**; předvyplněno: řidič = přihlášená osoba, start km =
  poslední odečet, odkud = cíl předchozí jízdy. Ukončení: km, kam, účel, volitelně tankování
  s fotkou účtenky.
- **Přehled „Jízdy"** v navigaci (sekce Pracovní postupy, `moduleKey: 'vehicles'`): všechna
  vozidla, filtr řidič/období/účel, upozornění na otevřené jízdy starší 24 h a na nezapsané km.
- **Tankování**: seznam, spotřeba l/100 km mezi plnými nádržemi, náklady za měsíc.
- **Uzávěrka měsíce**: kontrolní obrazovka (mezery, otevřené jízdy, chybějící účel) → Uzavřít.
- Čeština, styl stávajících stránek (`PageHeader`, `Section`, `DataTable`, `ActionForm`).

## Oprávnění / RBAC
Nové klíče v katalogu `permissions` (modul `vehicle`, sekce matice „Evidence vybavení"):
`vehicle.trip.view`, `vehicle.trip.create`, `vehicle.trip.update`, `vehicle.trip.delete`,
`vehicle.trip.manage` (uzávěrka, úprava cizích jízd), `vehicle.trip.export`,
`vehicle.fuel.view`, `vehicle.fuel.create`. Popisky v `packages/shared/src/roles.ts`
(`vehicle.trip`: „Kniha jízd", `vehicle.fuel`: „Tankování").
Výchozí šablony: `scan_only` a `viewer` = create (jen vlastní jízdy) + view vlastních;
`editor` = view/create/update; `manager` = vše včetně manage/export; owner/admin implicitně vše.
**Řidič vidí a upravuje jen své jízdy** (scope `OWN` přes `driver_person_id` ↔ osoba
přihlášeného), dokud nemá `vehicle.trip.view`. Respektuje se `LOCATION_TREE` scope
(vozidla mimo subtree nevidí). Gate modulem `vehicles` (EPIC-20 entitlementy).

## RLS a izolace
Obě tabulky: `ENABLE` + `FORCE ROW LEVEL SECURITY`, politika `tenant_isolation` na
`app.tenant_id`, `GRANT … TO tagery_app` (vzor migrací `AssetPurchase`, `Calendar`).
FK na `assets`, `people`, `reservations` vždy se shodným `tenant_id` (kontrola v service +
složený dotaz). Izolační testy: cizí `asset_id`/`driver_person_id`/`reservation_id` → 404.

## 8. Právní a daňové hledisko (ČR) – k ověření s daňovým poradcem
- Kniha jízd není jednotně předepsaná zákonem, ale je **běžně vyžadovaným důkazním
  prostředkem** pro: uplatnění výdajů na PHM a vozidlo (ZDP §24), paušální výdaj na dopravu
  (§24 odst. 2 písm. zt – pak stačí prokázat užití, ne PHM), náhrady zaměstnancům při použití
  soukromého vozu (ZP §157–158), odpočet DPH u vozidla používaného i soukromě (krácení
  poměrem, ZDPH §75) a posouzení soukromého užití služebního vozu (nepeněžní příjem 1 %/0,5 %
  vstupní ceny, ZDP §6 odst. 6).
- Praxe správce daně: **datum, řidič, účel cesty, trasa (odkud–kam), ujeté km, stav
  tachometru**, soulad s doklady o tankování a s kontinuitou tachometru. Proto: kontinuita
  odečtů, povinný účel u služebních jízd, nezapsané km viditelně, uzávěrka a **neměnnost po
  uzávěrce** (oprava jen se záznamem v auditu), archivace min. dle lhůty pro stanovení daně
  (typicky 3–10 let) – žádné fyzické mazání.
- GDPR: kniha jízd obsahuje osobní údaje řidičů (pohyb). Účel = plnění právní povinnosti /
  oprávněný zájem; soukromé jízdy v exportu pro třetí strany lze anonymizovat (jen km).
- Export ve formátu přijatelném pro účetní (XLSX + PDF s hlavičkou: firma, SPZ, období,
  souhrny, podpis/odpovědná osoba).

## Vazba na kalendář a rezervace
- **Rezervace → jízda:** u schválené/vydané rezervace vozidla tlačítko „Začít jízdu"
  (předvyplní řidiče = žadatel, účel = `purpose`, `reservation_id`). Po ukončení poslední
  jízdy lze rezervaci označit jako vrácenou.
- **Kalendář (F3):** nový zdroj `trip` v `CALENDAR_SOURCES` (`packages/shared/src/calendar.ts`)
  s oprávněním `vehicle.trip.view`; veřejné sdílení jen `Jízda: <SPZ/vozidlo>` bez řidiče a
  trasy. **Předpoklad: `feature/calendar` je mergnutá do `main`** (nasazeno, merge čeká na
  dokončení práce na pozicích).
- Upozornění (EPIC notifikací): otevřená jízda > 24 h, nezapsané km při uzávěrce.

## Fázování
- **F1 – Jádro knihy jízd:** migrace `vehicle_trips` + `source`/`source_id` na odečtech,
  refaktor `MeterReadingsService`, `vehicle-trips.logic.ts` (kontinuita, zpětné zápisy,
  součty) s unit testy, API start/finish/zpětný zápis/storno, záložka v detailu vozidla,
  oprávnění + RLS + izolační testy. Odhad ~3–4 dny.
- **F2 – Mobil a tankování:** rychlá jízda po skenu, „Moje jízdy", `vehicle_fuel_entries`
  s fotkou účtenky, spotřeba, přehled „Jízdy". Odhad ~2–3 dny.
- **F3 – Daňová průkaznost a vazby:** měsíční souhrn, nezapsané km, uzávěrka a zamčení,
  export XLSX/PDF, napojení na inventuru vozidel, rezervace → jízda, zdroj `trip` v
  kalendáři. Odhad ~3 dny.
- **F4 – rozšíření (volitelné):** našeptávání tras z míst/historie, výpočet vzdálenosti přes
  mapové API, import z telematiky/OBD, akce `trip.start/finish` v EPIC-22 (Telegram/MCP),
  cestovní náhrady.

## Závislosti
EPIC-03 (RLS, people), EPIC-18 (oprávnění, scope OWN/LOCATION_TREE, audit), EPIC-20 (modul
`vehicles`), stávající údržba vozidel (`asset_meter_readings`, `asset_maintenance_rules`),
inventura vozidel (commit 6158f46), rezervace, kalendář (`feature/calendar` – merge do main),
úložiště médií (účtenky), exporty (`packages/shared/src/exports.ts`).

## Otevřené otázky
1. Má mít `scan_only`/`viewer` právo zapisovat jízdy (řidiči bez dalších práv), nebo
   zavést samostatnou systémovou roli „Řidič"?
2. Povinnost knihy jízd per vozidlo (přepínač „vede se kniha jízd") vs. pro všechna vozidla?
3. Soukromé jízdy u služebních vozů: evidovat detail trasy, nebo jen km (GDPR minimalizace)?
4. Uzávěrka měsíce: ruční (manager) nebo automatická k X. dni dalšího měsíce?
5. Elektromobily: tankování v kWh a nabíjení doma – stačí `fuel_type = electric_kwh`?
6. Tankování firemní kartou – budoucí import výpisů (CCS, Shell…)?
7. Formát exportu: požadavky konkrétní účetní (sloupce, PDF vzor) – získat vzor.
8. Jak naložit s historickými odečty bez jízd – zobrazit jako „nezapsané km" až od data
   zapnutí knihy jízd u vozidla?

## Definition of Done
Viz `tasks/ROADMAP.md` §DoD. Navíc: každá jízda má odpovídající odečty v
`asset_meter_readings` a servisní plány/inventura vozidel ukazují stejné km; validace
kontinuity pokrytá unit testy (zpětné zápisy, mezery, souběžná otevřená jízda); izolační testy
RLS; uzamčené měsíce nejdou změnit bez `manage` a auditu; export ověřený s účetní.
