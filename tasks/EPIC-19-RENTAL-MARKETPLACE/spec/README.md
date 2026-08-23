# EPIC-19-RENTAL-MARKETPLACE – Veřejná půjčovna / marketplace

## Stav: ⬜ NÁVRH SCHVÁLEN – rozhodnutí A/B/C potvrzena (2026-08-23), čeká na start F1

**Potvrzeno:** A = storefront **jedné firmy** s přípravou na budoucí marketplace ·
B = **QR platby v MVP** s přípravou na Stripe · C = **povinný účet nájemce** (musí vidět
svoje výpůjčky a mít přístup k nahlášení poškození/poruchy).

## Cíl
Umožnit tenantovi (firmě) dát vlastní **Věci (assets)**, které zrovna nevyužije, veřejně
**k zapůjčení**. Vznikne veřejná stránka (storefront/katalog), kde jsou publikované věci
s **ceníkem**; zájemce vytvoří **objednávku**, ze které se vygenerují **pokyny k platbě**.
Model peněz je navržený tak, aby platforma **nedržela cizí peníze** (viz Platby / Rizika).

Rozšiřuje interní [[EPIC-10-RENTAL]] (půjčky, ověření nájemce, sdílená reputace) o **veřejný
prodejní kanál** a **platby**.

---

## Vztah k existujícím stavebním blokům (znovupoužití)
| Blok | Odkud | Jak využijeme |
|---|---|---|
| Věc (Asset), stav, pohyby (loan/return, vrácení s fotkou) | EPIC-03/asset | Předmět inzerátu + custody životní cyklus objednávky |
| Galerie fotek věci (hlavní + další) | (nové, 2026-08) | Vizuál inzerátu; hlavní fotka = náhled v katalogu |
| Domovská lokace věci | asset | Výchozí místo vyzvednutí (pickup) |
| Veřejný resolver `/r/{code}` + vzor **SECURITY DEFINER** cross-tenant čtení | EPIC-05, ADR-0002 | Veřejný katalog čte publikované inzeráty **mimo tenant kontext**, bez porušení RLS |
| DataCarrier / QR | EPIC-04 | QR na věci může vést rovnou na inzerát; QR platba (SPAYD) |
| RenterProfile (platform-shared reputace), verification levels | EPIC-10, ADR-0005 | Ověření a reputace nájemce napříč tenanty |
| Billing / money-flow, PSP stub | EPIC-17, ADR-0007 | Provize/předplatné firmě; pozdější PSP adaptér |

---

## Architektura

### 1) Publikace + datový model (tenant-scoped, RLS)
- **`rental_listing`**: `asset_id` (→ Věc), `status` (draft/published/paused/archived),
  `title`, `description`, `terms`, `pickup_location_id` (default = home věci),
  `currency`, `price_per_day`, `price_per_hour?`, `price_per_week?`, `deposit_amount`,
  `min_days`, `max_days`, `slug` (veřejný), `published_at`.
  - Ceník je na **inzerátu**, ne na věci (věc může být půjčovaná i evidenční).
- **`rental_order`**: `listing_id`, `asset_id`, **`renter_user_id` (povinný – účet, rozh. C)**
  + `renter_profile_id` (platform reputace), `period` (from/to), rozpad ceny
  (`rent_amount`, `deposit_amount`, `total`), `status` (viz stavový automat),
  `payment_method`, `payment_ref`, `deposit_ref`.
- **Dostupnost bez překryvu**: Postgres `EXCLUDE USING gist` na
  `(asset_id WITH =, period WITH &&)` (rozšíření `btree_gist`) pro objednávky v aktivních
  stavech → DB tvrdě zabrání dvojité rezervaci.

### 2) Veřejné čtení (cross-tenant, bez porušení izolace)
Katalog zobrazuje inzeráty z více tenantů → **nesmí** jít přes běžný tenant-scoped RLS
dotaz. Použijeme vzor z resolveru:
- **SECURITY DEFINER** funkce `public_listings(filter)` a `public_listing(slug)`, které vrací
  **jen `status='published'`** a joinují název věci + hlavní fotku. Čte se mimo tenant kontext,
  žádná privátní data neúniknou (whitelist sloupců).
- Veřejné web routy bez auth (jako `/r`): katalog + detail + objednávka.

### 3) Platební adaptér (klíčové rozhodnutí návrhu)
Zavedeme abstrakci **`PaymentAdapter`**, aby přechod z MVP na „jako Alza" byl výměna
adaptéru, ne přepis objednávek:
```
interface PaymentAdapter {
  createCharge(order): Promise<PaymentInstruction>   // QR/SPAYD string | PSP intent
  captureDeposit?(order): Promise<void>              // strhnout kauci (škoda)
  releaseDeposit?(order): Promise<void>              // uvolnit předautorizaci
  refund?(order, amount): Promise<void>
  handleWebhook?(payload): Promise<PaymentEvent>     // potvrzení platby
}
```
- **Adapter A – QR/převod (MVP):** vygeneruje český **SPAYD** (QR platba) + bankovní údaje
  **majitele**. Peníze tečou majitel↔nájemce **přímo**, platforma je nedrží. Kauce manuálně.
  Provize = fakturujeme firmě přes předplatné (EPIC-17), ne skimming z transakce.
- **Adapter B – Stripe Connect (fáze 2, „jako Alza/Allegro"):** jednorázová platba nájemce;
  `application_fee` = naše provize; majitel = connected (Express) account (**KYC dělá Stripe**);
  výplaty řídí Stripe; **kauce = předautorizace** karty (auth → capture/cancel při vrácení).
  Platforma zůstává **mimo licenci platební instituce**, protože regulovaný je PSP.

### 4) Přístupový model nájemce (rozh. C – povinný účet)
Nájemce je **platformová identita** ([[EPIC-18]] `User`, unikátní e-mail), **není členem
org tenanta** – nedostává tenant membership ani role v cizí firmě. Jeho přístup je
**self-scoped**: vidí jen `rental_order` kde `renter_user_id = já` (napříč firmami).
- **Renter portál „Moje výpůjčky":** přehled aktivních/historických výpůjček, stav, pokyny
  k platbě, doba, místo vyzvednutí/vrácení.
- **Hlášení poškození/poruchy:** nájemce s aktivní (nebo nedávnou) výpůjčkou může na
  půjčené věci založit **Issue** (znovupoužití `asset.reportIssue`) – gate „mám objednávku
  na tuto věc", ne tenant membership. Majitel to vidí ve „Vyžaduje pozornost".
- Přístup nájemce = nová „relace vlastníka objednávky", oddělená od admin RBAC firmy.

### 5) Stavový automat objednávky
`pending → awaiting_payment → paid → confirmed → picked_up → returned → completed`
(+ `cancelled`, `expired`). `paid` potvrzuje platební adaptér (webhook/manuál). `picked_up`
= vytvoří `loan` pohyb věci; `returned` = return pohyb (vrácení s fotkou) + vypořádání kauce.

---

## Fázování

### F1 – Publikace + veřejný storefront (read-only)
- ⬜ `rental_listing` entita + migrace (RLS, GRANT, index)
- ⬜ Admin UI: publikovat věc jako inzerát + ceník (den/hodina/týden, kauce, min/max, podmínky)
- ⬜ `public_listings()` / `public_listing(slug)` SECURITY DEFINER (whitelist sloupců)
- ⬜ Veřejné SSR routy: katalog + detail (fotky z galerie, cena, místo vyzvednutí), SEO
- ⬜ E2e: publikace → viditelné veřejně; skrytí → zmizí; cross-tenant čtení bez úniku privátních dat

### F2 – Dostupnost + rezervace + veřejná objednávka
- ⬜ `rental_order` + `EXCLUDE` constraint (žádný překryv)
- ⬜ Výpočet ceny (doba × sazba + kauce), kalendář dostupnosti
- ⬜ **Registrace/přihlášení nájemce** (rozh. C) – účet ([[EPIC-18]] identita) je podmínka
  objednávky; objednávka ve stavu `awaiting_payment` má `renter_user_id`
- ⬜ Napojení na verification level nájemce (EPIC-10) dle politiky inzerátu
- ⬜ E2e: bez účtu nelze objednat; rezervace období, konflikt → odmítnuto, cena spočtena

### F3 – Objednávka → QR platba + předání/vrácení + kauce
- ⬜ `PaymentAdapter` rozhraní + **Adapter A (SPAYD/QR + bankovní údaje majitele)**
- ⬜ Potvrzení platby (manuál/účtenka) → `paid`; pokyny k platbě na stránce objednávky + e-mail
- ⬜ `picked_up` → loan pohyb; `returned` → return + vypořádání kauce (manuálně)
- ⬜ **Renter portál „Moje výpůjčky"** (self-scoped) – přehled + stav + pokyny k platbě
- ⬜ **Hlášení poškození/poruchy** nájemcem na půjčené věci (znovupoužití `asset.reportIssue`,
  gate „mám objednávku na tuto věc") → majiteli do „Vyžaduje pozornost"
- ⬜ E2e: objednávka → QR/pokyny → potvrzení → předání → nájemce nahlásí poškození → vrácení → completed

### F4 – Karty přes PSP + provize/výplaty + hodnocení (marketplace „jako Alza")
- ⬜ **Adapter B – Stripe Connect** (Express účty, application_fee, payouty)
- ⬜ Onboarding majitele (KYC přes Stripe), webhooky, refundy/chargebacky
- ⬜ Kauce jako **předautorizace** (auth/capture/cancel)
- ⬜ Oboustranné hodnocení (EPIC-10 reputace), moderace inzerátů
- ⬜ **Nový ADR** „marketplace-payments" (adapter, tok peněz, mimo-licenci princip)

---

## Klíčová rozhodnutí (POTVRZENO 2026-08-23)
| # | Otázka | Rozhodnutí |
|---|---|---|
| A | Rozsah v F1 | ✅ **Storefront jedné firmy**, navržený s přípravou na budoucí globální marketplace |
| B | Platba MVP | ✅ **QR/převod majiteli** (F3), příprava na **Stripe Connect** (F4) přes PaymentAdapter |
| C | Identita nájemce | ✅ **Povinný účet** – nájemce se musí přihlásit; vidí svoje výpůjčky (renter portál) a hlásí poškození/poruchu |

---

## Rizika / regulace
- **Platby & licence:** držení cizích peněz + provize z transakce ⇒ „platební instituce"
  (licence, AML, kapitál). **Mitigace:** MVP peníze přímo majitel↔nájemce; provize
  fakturujeme firmě; PSP (Stripe) drží/rozúčtuje peníze až ve F4 → platforma mimo licenci.
- **Kauce/škody:** MVP manuálně; F4 předautorizace karty.
- **Dvojitá rezervace:** DB `EXCLUDE` constraint.
- **GDPR:** údaje nájemce = osobní data (souhlas, retence, právo na výmaz).
- **Důvěra/moderace:** veřejné inzeráty – odpovědnost za stav/podmínky/reklamace na majiteli;
  potřeba moderace a reportování.
- **Daně/fakturace:** fakturuje majitel (jeho DPH), ne platforma.

## Otevřené otázky
- **Model věci:** EPIC-10 má vlastní `Item`/`Loan`; marketplace míří na `Asset` (Věc).
  Sjednotit (inzerát referencuje `Asset`, `Loan`↔`Movement`) nebo mostem? → rozhodnout v F1.
- Slug/URL: `app.tagery.tech/pujcovna/{firma}/{inzerat}` vs. vlastní doména firmy.
- Měna/DPH/vícejazyčnost (i18n je na roadmapě).

## Závislosti
- [[EPIC-10-RENTAL]] (půjčky, reputace, verification), EPIC-05 RESOLVER (veřejné čtení),
  EPIC-17 BILLING + ADR-0007 (tok peněz), EPIC-04 (carriers/QR), EPIC-18 (identita nájemce).
- Nový ADR pro marketplace platby (F4).
