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
| SEC-01 | SSRF ochrana doménových webhooků (jen veřejné adresy, bez přesměrování, https v produkci) | S | – | vývoj | ⬜ |
| SEC-02 | Lokální úložiště: klíč nesmí opustit kořenový adresář (path traversal) | S | – | vývoj | ⬜ |
| SEC-03 | Demo seedy (známé heslo) neběží v produkci; produkce odmítne výchozí tajemství | S | – | vývoj | ⬜ |
| SEC-04 | Změnit heslo / deaktivovat demo účty v produkčním Demo Tenantu | S | – | Štěpán | 🧭 |
| SEC-05 | Ověření obsahu nahrávaných souborů podle magických bajtů (nejen MIME z klienta) | S | – | vývoj | ⬜ |
| SEC-06 | Prověřit CSRF u BFF/cookie operací webu | S | – | vývoj | ⬜ |
| SEC-07 | Sjednotit permission enforcement, odstranit dočasné allow chování scope/policy | M | – | vývoj | ⬜ |
| SEC-08 | Rotace výchozích hesel DB rolí (`tagery`, `tagery_app`) + runbook rotace tajemství | S | INF-01 | Infra | ⬜ |
| SEC-09 | Retence a výmaz osobních údajů, médií a auditu (GDPR) | M | – | vývoj | ⬜ |
| QA-01 | E2E smoke hlavního průchodu (přihlášení → místo → osoba → položka → výpůjčka → vrácení) na izolovaném stacku | M | – | vývoj | ⬜ |
| QA-02 | Browser E2E (Playwright) hlavního průchodu z MVP kap. 3 | M | QA-01 | vývoj | ⬜ |
| QA-03 | CI: migrace nad čistým PostgreSQL + testy (GitHub Actions) | S | QA-01 | vývoj | ⬜ |
| QA-04 | OpenAPI dokumentace MVP API | S–M | – | vývoj | ⬜ |
| INF-01 | Denní zálohy PostgreSQL + úložiště, mimo server, s otestovanou obnovou | M | – | Infra | ⬜ |
| INF-02 | R2/S3 `StoragePort` (média mimo disk VPS) | M | INF-01 | vývoj + Infra | ⬜ |
| INF-03 | Monitoring: health/readiness, error tracking, alerty | S–M | – | Infra | ⬜ |
| INF-04 | Runbook deploy / rollback / migrace / incident | S | INF-01 | vývoj + Infra | ⬜ |
| PRC-01 | Ceník: neomezení „skenovací“ uživatelé, limity podle položek a správců | S | DEC-02 | vývoj | 🧭 |
| REV-01 | Revize a BOZP: šablony lhůt dle CZ legislativy, stav způsobilosti | M | DEC-01, plán `plan-revize-bozp.md` | vývoj | ⏸ |
| REV-02 | Blokace výdeje (varovat / zakázat) u vadného, neprověřeného nebo bez průkazu | M | REV-01 | vývoj | ⏸ |
| REV-03 | PDF složka položky pro inspektorát | S–M | REV-01 | vývoj | ⏸ |
| REV-04 | Předávací protokol v PDF s podpisem prstem | S–M | plán `plan-revize-bozp.md` | vývoj | ⏸ |
| NOT-01 | Ranní e-mail „co dnes hoří“ + e-mailové připomínky termínů | S | – | vývoj | ⬜ |
| AUTH-01 | Přihlášení Google / Microsoft (OAuth/OIDC) | S–M | – | vývoj | ⬜ |
| GTM-01 | Oborové šablony (kategorie, revize, dashboard) + asistovaný import | M | DEC-01 | vývoj | 🧭 |

## Další

| ID | Úkol | Vel. | Závisí na | Vlastník | Stav |
|---|---|---|---|---|---|
| ZAK-01 | Zakázky / stavby (entita nebo typ místa) | M | DEC-03, plán | vývoj | 🧭 |
| ZAK-02 | Vnitropodnikové sazby (den/týden/měsíc, strop) a report nákladů po zakázkách | M | ZAK-01 | vývoj | ⏸ |
| ZAK-03 | Report vytíženosti (dokoupit / prodat ležáky) | S–M | – | vývoj | ⬜ |
| INT-01 | Veřejné API s klíči (scopes) + dokumentace | S–M | QA-04 | vývoj | ⬜ |
| INT-02 | Export do účetnictví (Pohoda XML / Money S3): majetek, náklady | M | DEC-04, ZAK-02 | vývoj | 🧭 |
| MOB-01 | Offline fronta akcí a cache v Capacitoru | M–L | – | vývoj | ⬜ |
| MOB-02 | Push notifikace (FCM / APNs) | M | DEC-05 | vývoj | 🧭 |
| PPL-01 | Průkazy obsluhy u osob s platností a vazbou na výdej | S–M | REV-02 | vývoj | ⏸ |
| ORG-01 | Více středisek: viditelnost a správa podle pobočky (scopes authz v2) | S–M | SEC-07 | vývoj | ⬜ |
| VEH-01 | Kniha jízd (EPIC-23) | M | – | vývoj | ⬜ |
| WAR-01 | Hlídání záruky při zápisu servisu + reklamační protokol | S | – | vývoj | ⬜ |
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

_(doplňuje se s každým commitem)_
