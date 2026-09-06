# Tagery Věci – roadmapa k funkčnímu MVP

> Stav: schválený směr MVP
> Aktualizováno: 2026-09-06
> Účel: převést současný technický základ do nasaditelného a prodejně ověřitelného produktu.

## 1. Produktové rozhodnutí

První MVP není obecná platforma se všemi plánovanými moduly. První MVP je:

> **Tagery Věci – jednoduchá evidence, dohledání, předávání a inventura firemního vybavení pomocí QR štítků.**

Primární zákazník je malá nebo střední firma, spolek, půjčovna vybavení nebo provozní tým,
který potřebuje vědět:

- jaké věci vlastní,
- kde věci jsou a komu byly předány,
- kdy se mají vrátit nebo jít do servisu,
- zda byly nalezeny při inventuře,
- co se s nimi v minulosti dělo.

QR/NFC, multi-tenancy, oprávnění a resolver zůstávají společným technologickým jádrem.
Ostatní doménové moduly se nemažou, ale nejsou součástí základního MVP a nesmí blokovat jeho dokončení.

## 2. Rozsah MVP

### Součást MVP

- registrace firmy a prvního vlastníka,
- přihlášení, obnova hesla a pozvání kolegy,
- role a izolace dat mezi firmami,
- lidé, kategorie a místa včetně úložných buněk,
- vytvoření a CSV import/export položek,
- fotografie, dokumenty, specifikace a manuály položky,
- vytvoření, přiřazení a tisk QR identifikátoru,
- identifikace položky skenem nebo ručním zadáním kódu,
- předání, převzetí, přesun, vrácení a historie pohybů,
- termín vrácení, rezervace, závady, servis a revize,
- inventura, reconciliation a přehled položek vyžadujících pozornost,
- audit důležitých změn,
- základní dashboard a provozní notifikace,
- produkční nasazení, zálohy a monitoring.

### Mimo základní MVP

- Ticketing a Shared Gallery,
- Membership, Access Control a billing členství,
- veřejná síť půjčoven a sledování firem,
- Stripe Connect, KYC, karetní kauce a reputace nájemců,
- Time Tracking, Automation, Contact, Loyalty, Trace/DPP,
- SAML, SCIM, vlastní domény a nativní mobilní aplikace,
- gravírovací a 3D výrobní exporty.

Tyto funkce mohou zůstat v kódu za vypnutými moduly. V navigaci a onboardingu základního
zákazníka se nezobrazují.

## 3. Hlavní uživatelský průchod

MVP je dokončené, když nový zákazník bez zásahu provozovatele zvládne:

1. Zaregistrovat firmu a ověřit svůj účet.
2. Vytvořit první místo a člověka.
3. Přidat nebo importovat první položku.
4. Vygenerovat a vytisknout její QR štítek.
5. Telefonem položku naskenovat.
6. Předat ji člověku nebo přesunout na jiné místo.
7. Nastavit termín vrácení a následně ji vrátit.
8. Nahlásit závadu nebo zapsat servisní úkon.
9. Spustit inventuru a vyřešit nalezené rozdíly.
10. Pozvat kolegu s omezenou rolí a dohledat historii operací.

## 4. Realizační fáze

### M0 – Sjednocení produktu a rozsahu

**Cíl:** Jeden srozumitelný produkt místo katalogu nesouvisejících funkcí.

- [x] Aktualizovat PRD podle zaměření Tagery Věci.
- [x] Sjednotit stav EPICů v `tasks/ROADMAP.md` se skutečným kódem; historický
      `PICKUP.md` už v repozitáři není a roadmapa je jediný aktivní přehled.
- [x] Rozhodnout, které existující moduly budou ve výchozím stavu vypnuté.
- [x] Filtrovat navigaci a dashboard podle aktivních modulů a blokovat přímé admin/resolver routy.
- [x] Rozšířit module gate také na veřejné marketplace/network projekce.
- [x] Sjednotit názvosloví `Položka / Věc / Asset / DigitalObject` v produktové dokumentaci
      a hlavní navigaci; průběžně aplikovat při změnách jednotlivých obrazovek.
- [x] Rozhodnout o odstranění nebo migraci duplicitního modelu `rental_items`: `Asset` je
      kanonický model, legacy Rental se zmrazí a odstraní až po kontrole dat (ADR-0010).

**Výstup:** Uživatel po přihlášení vidí pouze funkce potřebné pro evidenci věcí.

### M1 – Samoobslužný onboarding

**Cíl:** Nový zákazník se dostane k prvnímu skenu bez ručního zásahu platform-admina.

- [x] Veřejná registrace firmy a prvního OWNER účtu.
- [x] Ověření e-mailu a bezpečné nastavení hesla.
- [x] Funkční SMTP/provider pro pozvánky a obnovu hesla (produkční SMTP + lokální Mailpit).
- [x] Pozvánka uživatele s jednorázovým odkazem platným 24 hodin místo zobrazení
      dočasného hesla.
- [x] Průvodce: firma → místo → první položka → štítek → sken; stav se odvozuje
      ze skutečných dat organizace.
- [x] Ukázková data jako volitelná součást onboardingu.
- [x] Prázdné stavy s jasnou následující akcí.

**Ověřeno 2026-09-06:** registrace → SMTP e-mail → aktivace → odmítnutí opakovaného
tokenu → login → ukázkové místo/položka → QR → resolver sken; stejným způsobem ověřena
pozvánka kolegy, nastavení hesla a přihlášení. Databázová migrace `1922000000000`.

**Akceptace:** Testovací zákazník bez nápovědy vytvoří první označenou položku do 10 minut.

### M2 – Dokončení provozního workflow věcí

**Cíl:** Každodenní evidence funguje od založení věci až po její vyřazení.

- [x] Projít a sjednotit přechody stavů položky a pohybový ledger.
- [x] Ověřit souběžné operace a transakčnost výdeje, vrácení a hromadných pohybů.
- [x] Doplnit archivaci/vyřazení položky a pravidla pro její identifikátory.
- [x] Dokončit rezervace včetně konfliktů a návaznosti na výdej.
- [x] Dokončit potvrzení převzetí druhou stranou.
- [x] Doplnit upozornění na opožděné vrácení, servis a otevřenou závadu.
- [ ] U všech seznamů doplnit použitelné filtrování, stránkování a řazení.
- [x] Ověřit CSV import na chybách, duplicitách a větších souborech.
- [ ] Ověřit tisk štítků na podporovaných tiskárnách a nabídnout PDF fallback.

**Akceptace:** Celý hlavní průchod z kapitoly 3 funguje na mobilu i desktopu bez zásahu do DB.

**Stav ověření 2026-09-06:** API smoke test nad Docker stackem prošel pro konflikt a splnění rezervace, potvrzení příjemcem, souběžný výdej, atomicitu bulk operace, vyřazení identifikátorů, PDF fallback a CSV duplicity/limity. Zbývá sjednotit filtrování/stránkování/řazení i mimo hlavní seznam věcí a rezervací a udělat fyzickou zkoušku podporovaných tiskáren.

### M3 – Bezpečnost a izolace

**Cíl:** Produkt může bezpečně pracovat s daty prvních reálných zákazníků.

- [x] V produkci vyžadovat `APP_DATABASE_URL` s rolí podléhající RLS.
- [x] Přidat automatické cross-tenant testy ke všem MVP entitám a `SECURITY DEFINER` funkcím.
- [ ] Dokončit a sjednotit permission enforcement; odstranit dočasné allow chování scope/policy.
- [x] Nastavit explicitní CORS allowlist a bezpečnostní HTTP hlavičky.
- [x] Přidat rate limiting na login, reset hesla, registraci a veřejné mutace.
- [ ] Prověřit CSRF ochranu BFF/cookie operací.
- [ ] Zavést limity velikosti, MIME kontrolu a bezpečné názvy nahrávaných souborů.
- [ ] Provést kontrolu SSRF u webhooků a AI-fetch integrací.
- [ ] Odstranit produkční výchozí secrets a sepsat rotaci tajemství.
- [ ] Definovat retenci a výmaz osobních údajů, médií a auditních dat.

**Akceptace:** Automatický test prokáže, že uživatel firmy A nemůže číst ani měnit data firmy B.

**Stav ověření 2026-09-06:** `test:rls` pod rolí `tagery_app` prošel nad 57 tenantovými tabulkami a zkontroloval bezpečný `search_path` 27 `SECURITY DEFINER` funkcí. Docker API prošlo startem, loginem, CORS testem s cizím originem a kontrolou bezpečnostních hlaviček.

### M4 – Spolehlivost a produkční infrastruktura

**Cíl:** Nasazení je opakovatelné, sledovatelné a obnovitelné.

- [ ] Implementovat R2/S3 `StoragePort`; lokální filesystem ponechat pouze pro vývoj/demo.
- [ ] Nahradit fire-and-forget ukládání `ScanEvent` odolnou frontou s retry a dead-letter stavem.
- [ ] Oddělit volitelnou n8n síť od základního Docker Compose profilu.
- [ ] Připravit staging a produkční konfiguraci s HTTPS.
- [ ] Zavést strukturované logy, request/correlation ID a sanitizaci citlivých dat.
- [ ] Doplnit error tracking, health/readiness endpointy, metriky a alerty.
- [ ] Automatizovat denní zálohy PostgreSQL a otestovat obnovu.
- [ ] Sepsat deploy, rollback, migration a incident runbook.
- [ ] Udělat základní zátěžový test resolveru a skeneru.

**Akceptace:** Novou verzi lze nasadit a vrátit zpět podle runbooku; obnova ze zálohy je prakticky ověřena.

### M5 – Automatické ověření a pilot

**Cíl:** MVP je připravené pro 3–5 pilotních zákazníků.

- [ ] V CI spouštět migrace nad čistým PostgreSQL a Redisem.
- [ ] Přidat databázové integrační testy RLS a kritických transakcí.
- [ ] Přidat browser E2E test hlavního průchodu z kapitoly 3.
- [ ] Ověřit upgrade databáze z poslední nasazené verze.
- [ ] Doplnit OpenAPI dokumentaci pro podporované MVP API.
- [ ] Provést kontrolu mobilního UX a základní WCAG audit.
- [ ] Připravit onboardingový a support runbook pro pilot.
- [ ] Nasadit pilot, sbírat chyby, čas k prvnímu skenu a týdenní aktivitu.
- [ ] Opravit blokující problémy nalezené pilotem před veřejným spuštěním.

**Akceptace:** Alespoň tři pilotní organizace provedou hlavní workflow s vlastními daty a alespoň dvě jej používají opakovaně další týden.

## 5. Priority

### P0 – bez toho MVP nevydávat

- samoobslužný onboarding a e-mailové pozvánky,
- zúžená navigace a jasné zapínání modulů,
- RLS/permission integrační testy,
- produkční úložiště médií,
- bezpečnostní hardening veřejných endpointů a uploadů,
- zálohy, restore, monitoring a stabilní deploy,
- E2E test hlavního provozního průchodu.

### P1 – dokončit během pilotu

- provozní e-mailové notifikace,
- stránkování a pokročilé filtry,
- lepší hromadné operace a CSV diagnostika,
- OpenAPI a integrační dokumentace,
- UX/accessibility opravy z pilotu.

### P2 – po potvrzení retence

- PWA a offline skenování,
- veřejná půjčovna jako placené rozšíření,
- Stripe Connect a karetní kauce,
- ERP/účetní integrace a API klíče,
- SSO/SCIM, custom domény a white-label,
- další doménové moduly podle skutečné poptávky.

## 6. Metriky MVP

- medián času od registrace k prvnímu úspěšnému skenu pod 10 minut,
- podíl nových firem, které označí alespoň 5 položek během prvního dne,
- počet aktivních organizací a aktivních uživatelů za týden,
- počet úspěšných skenů, pohybů a inventur za týden,
- podíl položek s dohledatelným držitelem nebo místem,
- počet kritických chyb a ztracených ScanEventů,
- retence pilotních organizací po 7 a 30 dnech.

## 7. Rozhodovací brána po pilotu

Po pilotu se podle reálného používání vybere další hlavní větev:

1. **Asset Operations:** hlubší evidence, servis, revize, sklady, ERP a offline režim.
2. **Rental Marketplace:** veřejný katalog, online platby, kauce, KYC a řešení sporů.
3. **Membership & Access:** členství, opakované platby, vstupy a benefity.

Do té doby se nové velké funkce z těchto větví neimplementují, pokud přímo neodstraňují
blokátor pilotního MVP.

## 8. Definition of Done MVP

MVP lze označit za hotové pouze tehdy, když současně platí:

- hlavní průchod je pokrytý automatickým E2E testem,
- produkční migrace proběhnou nad čistou i předchozí databází,
- tenant izolace je automaticky ověřena,
- nejsou známé kritické bezpečnostní chyby,
- uploady a média používají produkční objektové úložiště,
- existují zálohy a prakticky ověřený restore,
- chyby a nedostupnost vyvolají alert,
- onboarding nevyžaduje platform-admina,
- základní UI neukazuje moduly mimo MVP,
- alespoň tři pilotní zákazníci dokončili hlavní workflow s vlastními daty.
