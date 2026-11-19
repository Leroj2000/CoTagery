# Tagery – produktový backlog (ze strategické revize 18. 11. 2026)

> Zdroj: strategická revize „Tagery – kam posunout produkt“ (srovnání s trhem, pokrytí bolestí firem).
> Navazuje na `tasks/MVP-ROADMAP.md` (M3–M5) a `tasks/ROADMAP.md` (EPICy).
> Velikost: **S** = dny, **M** = 1–3 týdny, **L** = 1–2 měsíce (odhad).
> Stav: ⬜ čeká · 🟡 rozpracováno · ✅ hotovo · ⏸ blokováno · 🧭 **čeká na rozhodnutí Štěpána**
> Vlastník „Infra“ = Rentigon Infra (server, zálohy, Caddy, úložiště); ostatní = vývoj Tagery.

## Otevřená rozhodnutí (blokují navazující úkoly)

| ID | Rozhodnutí | Ovlivňuje | Stav |
|---|---|---|---|
| DEC-01 | Primární obor (stavby/montáže vs. správa budov/obce) | GTM-01, REV-*, ZAK-* | 🧭 |
| DEC-02 | Cenový model (za položky + správce, terén zdarma vs. za uživatele) | PRC-01 | 🧭 |
| DEC-03 | Zakázka jako nová entita vs. typ místa | ZAK-01 | 🧭 |
| DEC-04 | Které účetnictví napojit první (Pohoda / Money S3 / Helios) | INT-02 | 🧭 |
| DEC-05 | Kdy Apple Developer Program + D-U-N-S (Destrukta) | MOB-02, MOB-03, NFC-01 | 🧭 |
| DEC-06 | Zmrazit moduly mimo jádro (ticketing, členství, galerie, marketplace) do validace pilotem | celý backlog | 🧭 |

## Teď

| ID | Úkol | Vel. | Závisí na | Vlastník | Stav |
|---|---|---|---|---|---|
| SEC-01 | SSRF ochrana doménových webhooků (jen veřejné adresy, bez přesměrování, https v produkci) | S | – | vývoj | ✅ d28d450 |
| SEC-02 | Lokální úložiště: klíč nesmí opustit kořenový adresář (path traversal) | S | – | vývoj | ✅ 3544795 |
| SEC-03 | Demo seedy (známé heslo) neběží v produkci; produkce odmítne výchozí tajemství | S | – | vývoj | ✅ 429de21 |
| SEC-04 | Změnit heslo / deaktivovat demo účty v produkčním Demo Tenantu | S | – | Štěpán | 🧭 |
| SEC-05 | Ověření obsahu nahrávaných souborů podle magických bajtů (nejen MIME z klienta) | S | – | vývoj | ✅ e12943e |
| SEC-06 | Prověřit CSRF u BFF/cookie operací webu | S | – | vývoj | ✅ prověřeno |
| SEC-07 | Sjednotit permission enforcement, odstranit dočasné allow chování scope/policy | M | – | vývoj | ✅ guard-coverage test + analytics/fabrication pod PermissionsGuard |
| SEC-08 | Rotace výchozích hesel DB rolí (`tagery`, `tagery_app`) + runbook rotace tajemství | S | INF-01 | Infra | ⬜ zadání pro Infra |
| SEC-09 | Retence a výmaz osobních údajů, médií a auditu (GDPR) | M | – | vývoj | ⬜ |
| QA-01 | E2E smoke hlavního průchodu (přihlášení → místo → osoba → položka → výpůjčka → vrácení) na izolovaném stacku | M | – | vývoj | ✅ b6c9cd5 |
| QA-02 | Browser E2E (Playwright) hlavního průchodu z MVP kap. 3 | M | QA-01 | vývoj | ✅ Playwright E2E v tools/smoke (7 kroků), v CI |
| QA-03 | CI: migrace nad čistým PostgreSQL + testy (GitHub Actions) | S | QA-01 | vývoj | ✅ 8a64446 (CI zelené) |
| QA-04 | OpenAPI dokumentace MVP API | S–M | – | vývoj | ✅ docs/api (OpenAPI 3.1 + přehled), hlídá test |
| INF-01 | Denní zálohy PostgreSQL + úložiště, mimo server, s otestovanou obnovou | M | – | Infra | ⬜ zadání pro Infra |
| INF-02 | R2/S3 `StoragePort` (média mimo disk VPS) | M | INF-01 | vývoj + Infra | ⬜ zadání pro Infra |
| INF-03 | Monitoring: health/readiness, error tracking, alerty | S–M | – | Infra | ⬜ |
| INF-04 | Runbook deploy / rollback / migrace / incident | S | INF-01 | vývoj + Infra | ⬜ |
| PRC-01 | Ceník: neomezení „skenovací“ uživatelé, limity podle položek a správců | S | DEC-02 | vývoj | 🧭 |
| REV-01 | Revize a BOZP: šablony lhůt dle CZ legislativy, stav způsobilosti | M | DEC-01, plán `plan-revize-bozp.md` | vývoj | ⏸ plán ke schválení |
| REV-02 | Blokace výdeje (varovat / zakázat) u vadného, neprověřeného nebo bez průkazu | M | REV-01 | vývoj | ⏸ |
| REV-03 | PDF složka položky pro inspektorát | S–M | REV-01 | vývoj | ⏸ |
| REV-04 | Předávací protokol v PDF s podpisem prstem | S–M | plán `plan-revize-bozp.md` | vývoj | ⏸ plán ke schválení |
| NOT-01 | Ranní e-mail „co dnes hoří“ + e-mailové připomínky termínů | S | – | vývoj | ⬜ posílá e-maily zákazníkům – spustit po souhlasu |
| AUTH-01 | Přihlášení Google / Microsoft (OAuth/OIDC) | S–M | – | vývoj | ⬜ |
| GTM-01 | Oborové šablony (kategorie, revize, dashboard) + asistovaný import | M | DEC-01 | vývoj | 🧭 |

## Další

| ID | Úkol | Vel. | Závisí na | Vlastník | Stav |
|---|---|---|---|---|---|
| ZAK-01 | Zakázky / stavby (entita nebo typ místa) | M | DEC-03, plán | vývoj | 🧭 plán ke schválení |
| ZAK-02 | Vnitropodnikové sazby (den/týden/měsíc, strop) a report nákladů po zakázkách | M | ZAK-01 | vývoj | ⏸ |
| ZAK-03 | Report vytíženosti (dokoupit / prodat ležáky) | S–M | – | vývoj | ✅ /admin/vytizenost + GET /reports/utilization (z knihy pohybů, bez DEC-03) |
| INT-01 | Veřejné API s klíči (scopes) + dokumentace | S–M | QA-04 | vývoj | ⬜ |
| INT-02 | Export do účetnictví (Pohoda XML / Money S3): majetek, náklady | M | DEC-04, ZAK-02 | vývoj | 🧭 |
| MOB-01 | Offline fronta akcí a cache v Capacitoru | M–L | – | vývoj | ⬜ |
| MOB-02 | Push notifikace (FCM / APNs) | M | DEC-05 | vývoj | 🧭 |
| PPL-01 | Průkazy obsluhy u osob s platností a vazbou na výdej | S–M | REV-02 | vývoj | ⏸ |
| ORG-01 | Více středisek: viditelnost a správa podle pobočky (scopes authz v2) | S–M | SEC-07 | vývoj | ⬜ |
| VEH-01 | Kniha jízd (EPIC-23) | M | – | vývoj | ⬜ |
| WAR-01 | Hlídání záruky při zápisu servisu + reklamační protokol | S | – | vývoj | ✅ Pozornost „Placené opravy v záruce“ + reklamační protokol (jen v aplikaci) |
| CAL-01 | Kalibrace měřidel: kalibrační list, stav způsobilosti | S | REV-01 | vývoj | ⏸ |

## Později

| ID | Úkol | Vel. | Závisí na | Vlastník | Stav |
|---|---|---|---|---|---|
| STK-01 | Spotřební materiál: množství, minimum, návrh objednávky | L | – | vývoj | ⬜ |
| ACC-01 | Odpisy a účetní hodnota majetku | S–M | INT-02 | vývoj | ⬜ |
| NFC-01 | Zápis NFC z appky iOS + Android | M | DEC-05 | vývoj | 🧭 |
| MOB-03 | Distribuce appky (TestFlight / Google Play) | S | DEC-05 | Štěpán + vývoj | 🧭 |
| GPS-01 | Poloha strojů z telematiky (Trackunit, výrobci) přes API | L | INT-01 | vývoj | ⬜ |
| BLE-01 | BLE tagy s polohou přes telefony | L | MOB-01 | vývoj | ⬜ |
| I18N-01 | Jazyky SK, EN, DE, PL | M | – | vývoj | ⬜ |
| ENT-01 | SAML / SCIM, SLA | L | AUTH-01 | vývoj | ⬜ |

## Záznam o hotových úkolech

- **SEC-01** (`d28d450`) – `apps/api/src/core/webhooks/url-guard.ts`: jen http(s) bez přihlašovacích údajů, v produkci jen https; DNS se přeloží a odmítnou se privátní, loopback, link-local (vč. cloud metadata), CGNAT, multicast a rezervované rozsahy IPv4/IPv6. Kontrola při registraci i před každým doručením, přesměrování se nesleduje. Výjimky přes `WEBHOOK_ALLOWED_HOSTS`. Zbytkové riziko: DNS rebinding v krátkém okně mezi kontrolou a fetch.
- **SEC-02** (`3544795`) – `LocalStorageAdapter` odmítne klíč s `..`, absolutní cestou, nulovým bajtem nebo mimo `STORAGE_LOCAL_PATH`.
- **SEC-03** (`429de21`, `434decf`) – `seed`/`seed:demo` se v `NODE_ENV=production` přeskočí (jen `SEED_DEMO=1`); migrační kontejner je dřív spouštěl při každém nasazení. Produkce odmítne `BILLING_WEBHOOK_SECRET=whsec_stub` a `JWT_SECRET` < 32 znaků. Seed na čisté DB padal na `tenants.slug` – opraveno.
- **SEC-04** – v produkci existuje `owner@demo.tagery` (role OWNER, Demo Tenant, 54 položek) se **známým heslem ze seedu**. Nové nasazení ho už nevytvoří, ale existující účet je potřeba zajistit (změna hesla / deaktivace) – čeká na Štěpána.
- **SEC-05** (`e12943e`) – média, manuály a dokumenty nákupu se ověřují podle magických bajtů (obrázek / video / PDF); SVG a HTML vydávané za obrázek se odmítnou. Fotky položek už dřív převáděl sharp na JPEG.
- **SEC-06** – prověřeno bez změny kódu: BFF `/api/*` v `middleware.ts` vyžaduje stejný origin (`Sec-Fetch-Site` / `Origin`) pro mutace, cookies `httpOnly` + `SameSite=Lax`; NestJS API cookies nečte (jen Bearer). Ověřeno na produkci: cross-site POST i POST bez Origin → 403.
- **QA-01** (`b6c9cd5`) – `pnpm smoke` / `tools/smoke/run.sh`: izolovaný projekt `tagery-smoke` (Postgres na tmpfs, Redis, API jen na 127.0.0.1:3901), migrace + seed, 12 kroků (401 bez přihlášení, login, místo, osoba, položka, výpůjčka, držitel a historie, vrácení, Pozornost, SSRF regrese). Stack se po běhu odstraní. Výsledek 19. 11. 2026: **12/12 OK**.
- **QA-03** (`8a64446`) – CI job `smoke` (build image + `tools/smoke/run.sh`) – migrace nad čistým PostgreSQL v každém pushi.
- Opraven test `custody.spec.ts` (`877d9e3`), který po 23. 10. 2026 padal kvůli reálnému času – celá sada API je zelená (57 sad / 434 testů).
