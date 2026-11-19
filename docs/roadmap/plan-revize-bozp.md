# Plán: revize a BOZP, blokace výdeje, složka pro inspektorát, podepsaný protokol, zakázky se sazbami

> Stav: **NÁVRH ke schválení Štěpánem** – nic z toho není implementováno.
> Backlog: REV-01…REV-04, PPL-01, CAL-01, ZAK-01, ZAK-02 (`docs/roadmap/BACKLOG.md`).
> Zásady: jen aditivní migrace, vše nad stávajícím modelem Asset / Movement / ServiceRecord / Issue,
> žádný paralelní model věci (ADR-0010), každá nová tabulka s `tenant_id` + RLS, nové controllery
> a oprávnění zapsat do `mcp-coverage.ts`.

## 0. Co už máme (výchozí bod)

| Oblast | Dnes v kódu |
|---|---|
| Servis / revize | `service_records` (`kind`: service, inspection, calibration, repair, warranty_claim; `performed_at`, `next_due_at`, `provider`, `cost`, `plan_code`, `meter_value`) |
| Plány údržby | `maintenance_rules` (interval v km/mth + měsících) – jen vozidla a stroje |
| Závady | `issues` (`kind`, `status` open/resolved) |
| Výdej | `asset_movements` (loan/assign/handover/…), potvrzení převzetí (`confirmation` pending/confirmed), hromadný výdej |
| Pozornost | `AssetService.attention()` – po termínu, servis, závady, záruky |
| Záruky | `asset_warranties`, `asset_purchases` |
| PDF | `pdfkit` (faktury, výrobní exporty) |
| Místa | `locations` + `location_types` (strom) |

## 1. Revize a kontroly podle legislativy (REV-01, CAL-01)

### Datový model (migrace `1930000000000-InspectionRegimes`)

- `inspection_regimes` – katalog druhů kontrol (systémové + vlastní firmy):
  `id, tenant_id NULL (= systémový), code, name, legal_basis, interval_months, interval_rule jsonb,
  requires_report bool, blocks_checkout_default ('off'|'warn'|'block'), created_at`.
  Systémové šablony (seed v migraci, bez tenantu, čitelné všem):
  - `elektro-ruční` – revize el. ručního nářadí dle ČSN 33 1600 ed. 2; lhůta z `interval_rule`
    podle skupiny užívání (A–E) a třídy ochrany (I/II/III),
  - `žebřík` – kontrola žebříků (NV 362/2005 Sb.), 12 měsíců,
  - `vázací-prostředky` – ČSN ISO 12480-1, 12 měsíců,
  - `motorová-pila` – NV 339/2017 Sb.,
  - `kalibrace` – podle metrologického řádu firmy (interval zadává firma),
  - `stk` – vozidla (napojit na stávající SPZ/STK údaje).
  Konkrétní lhůty v šablonách před vydáním **ověří odborník / revizní technik** – Tagery je evidence,
  ne právní výklad (text v UI).
- `asset_inspections` – přiřazení režimu k položce:
  `id, tenant_id, asset_id, regime_id, params jsonb (skupina užívání, třída ochrany…),
  last_service_record_id, next_due_at, result ('ok'|'defect'|'unfit'|null), checkout_mode
  ('inherit'|'off'|'warn'|'block'), created_at, updated_at`.
- `service_records` + sloupce (aditivně): `inspection_id uuid NULL`, `result text NULL`,
  `report_document_id uuid NULL` (revizní zpráva / kalibrační list jako `asset_documents`).
- `categories` + `default_regime_ids uuid[]` – nová položka v kategorii dostane režimy automaticky.

### Logika (čisté funkce + testy)
- `inspection.logic.ts`: výpočet `next_due_at` (interval_months nebo `interval_rule` dle parametrů),
  stav způsobilosti `fit | due_soon (≤30 dní) | overdue | unfit`.
- Zápis `service_records` s `inspection_id` přepočítá `asset_inspections.next_due_at` a `result`.
- `attention()` doplní „revize po termínu / brzy“ a „nezpůsobilé“.

### API
- `GET /inspection-regimes`, `POST/PATCH /inspection-regimes` (vlastní režimy)
- `GET/POST /assets/:id/inspections`, `PATCH/DELETE /assets/:id/inspections/:inspectionId`
- `POST /assets/:id/inspections/:inspectionId/record` (výsledek + volitelně PDF zprávy)
- `GET /inspections/due?within=30` (přehled pro plánování revizí)
- Oprávnění: `asset.inspection.view`, `asset.inspection.manage`; MCP: `inspection.due`, `inspection.list` (čtení).

### UI
- Detail položky: karta „Revize a kontroly“ (stav způsobilosti jako štítek, další termín, historie, nahrání zprávy).
- Kategorie: výchozí režimy.
- Nový přehled `/admin/inspections`: kalendář/seznam termínů, filtr podle místa, export CSV pro revizního technika.

## 2. Blokace výdeje (REV-02, PPL-01)

### Pravidla
Při `loan`, `assign`, `handover` (jednotlivě i hromadně, včetně MCP/Telegram akcí) se vyhodnotí:
1. otevřená závada typu kritická (nové pole `issues.severity`: `minor|critical`),
2. revize po termínu nebo výsledek `unfit`,
3. chybějící / propadlý průkaz obsluhy příjemce (PPL-01) u položek, jejichž kategorie ho vyžaduje.

Režim na úrovni firmy → kategorie → položky (`off | warn | block`):
- `warn` – výdej projde, ale vyžaduje potvrzení „Beru na vědomí“ a zapíše se do auditu i poznámky pohybu,
- `block` – API vrátí `409` s českým důvodem; přepsat může jen role s `asset.checkout.override` (audit).

### Datový model (migrace `1930100000000-CheckoutGuards`)
- `issues.severity text NOT NULL DEFAULT 'minor'`
- `tenants.settings.checkoutGuard` (jsonb klíč, výchozí `warn`), `categories.checkout_mode`, `asset_inspections.checkout_mode`
- `person_qualifications`: `id, tenant_id, person_id, code, name, valid_from, valid_to, document_id NULL`
- `categories.required_qualification_codes text[]`
- `asset_movements.guard_override jsonb NULL` (kdo, proč, jaká pravidla přepsal)

### API / logika
- `checkout-guard.logic.ts` (čistá funkce `evaluate(asset, recipient, context) → { level, reasons[] }`),
  volaná z `performMovement` a `bulk` před zápisem; `POST /assets/workflow/validate` vrací totéž pro UI.
- Endpointy pro průkazy: `GET/POST/PATCH/DELETE /people/:id/qualifications`.

### UI
- Výdej (sken i hromadný): červený / oranžový panel s důvody, tlačítko „Přesto vydat“ jen s oprávněním.
- Osoba: záložka „Průkazy a oprávnění“ s platností; Pozornost: propadající průkazy.

## 3. PDF složka položky pro inspektorát (REV-03)

- `GET /assets/:id/dossier.pdf` (pdfkit, stejný styl jako faktury): karta položky, identifikátory,
  stav způsobilosti, historie držitelů (z ledgeru), revize a kontroly s výsledky, závady, servisy,
  seznam příloh (zprávy, faktury, návody) + volitelně ZIP s přílohami `GET /assets/:id/dossier.zip`.
- Hromadně: `POST /dossiers` pro výběr / místo → ZIP (asynchronně, odkaz e-mailem při > 50 položek).
- Oprávnění `asset.dossier.export`; MCP vyloučeno (soubor).

## 4. Předávací protokol s podpisem (REV-04)

### Datový model (migrace `1930200000000-HandoverProtocols`)
- `handover_protocols`: `id, tenant_id, movement_ids uuid[], kind ('handover'|'return'|'service'),
  recipient_person_id, issuer_user_id, signed_at, signature_key (PNG v úložišti), signer_name,
  signer_ip, signer_user_agent, pdf_key, sha256, created_at`.
- Nemění se po podpisu (append-only, oprava = nový protokol); `sha256` PDF pro důkaznost.

### Tok
1. Výdej (i hromadný) → volba „Podepsat protokol“.
2. Podpis prstem na telefonu (canvas → PNG) nebo odkaz pro příjemce bez účtu (jednorázový token, 24 h).
3. Server vygeneruje PDF (logo firmy, položky, stav, podmínky / text dohody o odpovědnosti dle §252–255 ZP
   jako šablona firmy), uloží, přiloží k pohybům a pošle e-mailem příjemci.
- API: `POST /handover-protocols`, `POST /handover-protocols/:id/sign`, `GET /handover-protocols/:id.pdf`,
  veřejně `GET/POST /p/sign/:token`.
- Pozn.: jednoduchý elektronický podpis (ne kvalifikovaný) – pro interní evidenci obvykle stačí, text v UI.

## 5. Zakázky a vnitropodnikové sazby (ZAK-01, ZAK-02, ZAK-03)

### Varianta A – zakázka jako typ místa (rychlejší, doporučuji pro start)
- `location_types` dostane příznak `is_project`; místo typu „Zakázka“ má navíc `projects`
  rozšíření: `location_id, code, client, starts_on, ends_on, status, budget_equipment`.
- Pobyt na zakázce = čas, kdy byla položka (nebo její kontejner) na místě zakázky nebo u osoby
  přiřazené k zakázce (`asset_movements.project_id` volitelně při výdeji osobě).

### Varianta B – samostatná entita `projects`
- Nezávislá na stromu míst, víc míst na zakázku, vazba osob a pohybů; čistší pro účetnictví, ale ~2× práce.

### Sazby a náklady (obě varianty)
- `rate_cards`: `id, tenant_id, scope ('category'|'asset'), scope_id, per ('day'|'week'|'month'),
  amount, currency, cap_amount NULL, valid_from` (strop jako Hilti „cost capping“).
- `project-costs.logic.ts`: z ledgeru spočítá dny na zakázce po položkách × sazba, se stropem.
- `GET /projects/:id/costs?from&to`, `GET /reports/project-costs.csv`, `GET /reports/utilization`
  (vytíženost: % dní mimo sklad, ležáky, kandidáti na dokoupení).
- Export do účetnictví (INT-02) navazuje až po rozhodnutí DEC-04.

## 6. Fáze a odhad

| Fáze | Obsah | Odhad | Závisí na |
|---|---|---|---|
| F1 | REV-01 režimy + revize, CAL-01 kalibrace, Pozornost | 1,5–2 týdny | schválení plánu |
| F2 | REV-02 blokace výdeje + `issues.severity`, PPL-01 průkazy | 1–1,5 týdne | F1 |
| F3 | REV-03 PDF složka | 3–5 dní | F1 |
| F4 | REV-04 protokol s podpisem | 1–1,5 týdne | – (lze paralelně s F1) |
| F5 | ZAK-01 + ZAK-02 + ZAK-03 | 2–3 týdny | DEC-03 |

Každá fáze: unit testy logiky, rozšíření `tools/smoke/main-flow.mjs`, cross-tenant test nových tabulek,
`mcp-coverage.ts`, nasazení API a webu zvlášť s rollback image.

## 7. Otázky pro Štěpána

1. Pořadí: začít F1 (revize) a F4 (podpis) paralelně, nebo nejdřív jen F1?
2. Výchozí režim blokace pro nové firmy: `warn`, nebo `block`?
3. Mají šablony obsahovat jen elektro, žebříky, vázací prostředky, pily, kalibrace a STK, nebo ještě něco (tlakové nádoby, zdvihací zařízení, hasicí přístroje)?
4. Kdo z Destrukty může šablony lhůt odborně zkontrolovat (revizní technik)?
5. Podpis: stačí podpis prstem v telefonu vydávajícího, nebo i odkaz pro příjemce bez účtu?
6. Zakázka: varianta A (typ místa), nebo B (samostatná entita)? (DEC-03)
7. Sazby: za den stačí, nebo potřebujete i týden/měsíc a strop?
