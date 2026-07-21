# Tagery – Product Requirements Document (PRD)

> Autoritativní specifikace produktu. Zdrojem pravdy pro *proč* a *co*. *Jak* žije v `docs/architecture/` a `docs/modules/`.
> Verze: 0.2 · Stav: Draft k odsouhlasení · Vlastník: Product/Tech Lead

---

## 1. Vize a problém

Trh QR/NFC nástrojů je roztříštěný na jednoúčelové aplikace (marketing QR, ticketing, docházka, vizitky…). Firma, která chce QR/NFC použít pro víc scénářů, dnes platí a spravuje 3–5 různých nástrojů bez společné identity, analytiky a řízení práv.

**Tagery = jedna multi-tenant platforma**, kde fyzický nosič (QR / NFC / hybrid) vede na „digitální objekt", který obsluhuje libovolný modul. Společné jádro řeší identitu nosiče, směrování, bezpečnost, RBAC a analytiku; moduly řeší doménovou logiku.

**Hodnotová propozice:** jeden kód, jedna platforma, mnoho use-casů – se sdíleným jádrem, izolací dat a měřitelností.

## 2. Cílové segmenty a personas

| Persona | Role v systému | Potřeba |
|---|---|---|
| **Majitel firmy (SMB)** | OWNER | Rychle nasadit QR/NFC pro svůj scénář, vidět čísla |
| **Marketing manažer** | MANAGER/EDITOR | Dynamické QR, kampaně, branding, A/B, analytika |
| **Provozní pracovník** | SCAN_ONLY | Check-in, půjčení/vrácení, docházka – jen přes sken |
| **IT admin (enterprise)** | ADMIN | SSO, role, audit, integrace do ERP/CRM |
| **Koncový uživatel** | (neautentizovaný) | Naskenuje kód → dostane obsah/akci bez instalace appky |

## 3. Rozsah produktu

### 3.1 In scope (produktová vize)
Multi-tenant SaaS, 12 modulů nad společným jádrem: Product, Loyalty, Payment, Inventory, Trace, Membership, Ticketing, Rental, Shared Gallery, Time & Event Tracking, Automation, Contact. Plus průřezová schopnost **Access Control** (sdílí Ticketing + Membership). Detail v `docs/modules/` a `docs/reference/access-control.md`.

### 3.2 Out of scope (v1)
- Nativní mobilní aplikace (řešíme mobile-first web + PWA)
- Vlastní hardware (podpora tisku/tagů řešíme jen datově)
- Fakturační/billing systém tenantů (napojíme později, v0 manuálně)
- Marketplace mezi tenanty (v1 je marketplace = B2B repository *uvnitř* tenantu)

## 4. Jádro produktu (shrnutí, detail v architektuře)

`Tenant → Location → User` (+ `Group`) · `DigitalObject` (co to je + jaký modul) · `DataCarrier` (fyzický QR/NFC/hybrid nosič) · `ScanEvent` (log každé interakce) · **Resolver** `GET /r/{public_code}` (hot path). Viz `docs/architecture/README.md`.

## 5. Nefunkční požadavky (NFR)

| Kategorie | Požadavek | Cíl |
|---|---|---|
| **Výkon** | Resolver p95 latence (cache hit) | < 100 ms |
| **Výkon** | API p95 latence (čtení) | < 300 ms |
| **Škálovatelnost** | Sken throughput | 1 000 req/s bez degradace (horizontální škálování) |
| **Dostupnost** | Uptime resolveru (hot path) | 99.9 % |
| **Dostupnost** | Uptime admin API | 99.5 % |
| **Bezpečnost** | Izolace tenantů | Zero cross-tenant leak (viz ADR-0001) |
| **Bezpečnost** | Ochrana proti quishingu | Rate limit + detekce anomálií na resolveru |
| **Compliance** | GDPR | Právo na výmaz, retence, souhlas u galerie |
| **Compliance** | EU DPP | Trace modul připraven na Digital Product Passport |
| **Observability** | Tracing/metriky/logy | OpenTelemetry, per-tenant metriky |
| **Přístupnost** | WCAG | 2.1 AA na veřejných stránkách |
| **i18n** | Jazyky | CS + EN od v1, architektura připravená na další |

## 6. Klíčová produktová rozhodnutí (odkaz na ADR)
- **ADR-0001** – Model izolace tenantů (shared DB + RLS + `tenant_id`)
- **ADR-0002** – Resolver jako cachovaný hot path
- **ADR-0003** – Identifikátory, konvence schématu, `public_code`
- **ADR-0004** – Modulární monolit teď, extrakce služeb později

## 7. Success metriky (severní hvězda)
- **NSM:** počet úspěšných „resolutions" (scan → doručený obsah/akce) / týden
- Aktivace: čas od registrace tenantu k prvnímu naskenování < 10 min
- Retence: % tenantů s ≥1 aktivním objektem po 30 dnech
- Šíře: průměrný počet aktivních modulů na tenanta (validuje multi-modul tezi)

## 8. Rizika a mitigace

| Riziko | Dopad | Mitigace |
|---|---|---|
| Cross-tenant únik dat | Kritický | RLS + povinný `tenant_id` + automatické izolační testy (Stage 04) |
| Resolver je SPOF hot path | Vysoký | Cache/CDN, stateless, graceful degradace na read-replica |
| Přílišná šíře (11 modulů) rozmělní kvalitu | Vysoký | Přísná MVP sekvence, moduly za feature-flagy |
| Platby (PCI) | Vysoký | Delegace na PSP (Stripe/GoPay), netokáme karty |
| Ověření identity nájemce (KYC/PII) | Vysoký | Delegace na KYC providera, data minimization, šifrování, retence (ADR-0005) |
| Quishing zneužije dynamické QR | Střední | Podpisy, moderace cílů, rate limit, blocklist |
| WebNFC podpora v prohlížečích | Střední | Progressive enhancement, QR jako fallback |

## 9. Otevřené otázky (k rozhodnutí)
1. Cloud provider (AWS vs GCP) – ovlivní IaC a managed služby.
2. PSP pro CZ/SK trh: GoPay, Stripe, nebo Comgate?
3. Úložiště médií (Gallery): S3-compatible + CDN – které?
4. Rozsah v1 SSO: stačí OAuth2 (Google/MS), nebo hned SAML?
5. Single doména s path/subdoménou vs. custom domény per tenant od v1?
6. NFC provisioning na iOS – nativní appka / PWA-most, nebo v1 jen Android (Web NFC)?
7. Billing pricing (ADR-0007): pásma/cena za vydanou kartu · „vydaná" vs. „aktivní" karta (business TBD)

> Odpovědi na tyto otázky patří do ADR nebo do `_config/shared/`, jakmile padnou.
