# Tagery – Kompletní zadání projektu

> Konsolidovaný přehled ke čtení. Autoritativní detaily žijí v odkazovaných souborech (`PRD.md`, `architecture/`, `modules/`, `reference/`, `tasks/`).
> Verze 0.3 · 2026-07-19

---

## 1. Co stavíme

**Tagery** je **multi-tenant SaaS platforma** pro správu dynamických QR kódů a NFC tagů. Fyzický nosič (QR / NFC / hybrid) vede na **„digitální objekt"**, který obsluhuje jeden z modulů. Jedno společné jádro řeší identitu nosiče, směrování, bezpečnost, RBAC a analytiku; moduly řeší doménovou logiku (retail, eventy, půjčování, docházka, automatizace…).

**Hodnota:** jeden kód, jedna platforma, mnoho use-casů – se sdíleným jádrem, izolací dat tenantů a měřitelností. Odlišení od ME-QR/Uniqode/Flowcode: multi-modul + multi-tenant B2B + API-first.

## 2. Pro koho

| Persona | Role | Potřeba |
|---|---|---|
| Majitel firmy (SMB) | OWNER | Rychle nasadit QR/NFC, vidět čísla |
| Marketing manažer | MANAGER/EDITOR | Dynamické QR, kampaně, branding, analytika |
| Provozní pracovník | SCAN_ONLY | Check-in, půjčení, docházka jen přes sken |
| IT admin (enterprise) | ADMIN | SSO, role, audit, integrace |
| Koncový uživatel | (neautentizovaný) | Naskenuje kód → obsah/akce bez instalace appky |

## 3. Technologický stack

- **Frontend:** Next.js 14+ (App Router, SSR/SPA hybrid), TypeScript, Tailwind, mobile-first
- **Backend:** NestJS (modulární monolit), TypeScript, REST v1 (GraphQL později)
- **DB:** PostgreSQL (relační + JSONB), Redis (cache/fronty)
- **Auth:** JWT (access+refresh), OAuth2/SSO
- **Provoz:** Docker (lokálně Compose); nasazení = **Cloudflare na edge** (Pages, CDN/WAF, R2) + **kontejnerizovaný NestJS backend** (Fly/Railway/VPS) + Postgres(RLS)/Redis — ADR-0008

## 4. Klíčová architektonická rozhodnutí (ADR)

| ADR | Rozhodnutí |
|---|---|
| **0001** | Izolace tenantů: shared DB + povinný `tenant_id` + PostgreSQL RLS (3 vrstvy obrany) |
| **0002** | Resolver = cachovaný hot path; zápis ScanEvent asynchronně |
| **0003** | UUIDv7 PK, bezpečný nesekvenční `public_code`, soft-delete, audit log |
| **0004** | Modulární monolit teď, extrakce služeb (resolver, analytika, média) později |
| **0005** | Reputace nájemce platformově sdílená (Uber/Bolt) – úzká výjimka z 0001 |
| **0006** | Access Control jako průřezová sdílená schopnost (Ticketing + Membership) |
| **0007** | Billing: členské platby přes tenant-owns-PSP (Stripe Connect); monetizace Tagery = fee za počet vydaných karet |
| **0008** | Deployment: Cloudflare na edge (Pages/CDN/WAF/R2) + kontejnerizovaný NestJS backend + Postgres(RLS)/Redis |

## 5. Jádro (společné pro všechny moduly)

```
Tenant ──< Location
   │
   └──< User (role) ──< GroupMember >── Group

DigitalObject (co to je + module_type)
   └──< DataCarrier (qr | nfc | hybrid, public_code)
   └──< ScanEvent (log každé interakce)
   └──< ObjectPermission (per-objektové ACL)
```

- **DigitalObject** – `module_type`, `slug`, `status`, `primary_url`, `metadata_json`, platnost (`valid_from/to`)
- **DataCarrier** – fyzický nosič; jeden objekt může mít víc nosičů; `public_code` v URL
- **ScanEvent** – analytika, bezpečnost; typy: scan/tap/open/checkin/checkout/upload/pay/return/habit
- **Resolver** `GET /r/{public_code}` – veřejný hot path: lookup → validace → modulový `handleScan()` → async ScanEvent → HTML/JSON

## 6. Bezpečnost a izolace (kritické)

1. **Každý SQL dotaz filtruje `tenant_id`** (bere se z JWT, nikdy z URL/body)
2. RLS na úrovni DB jako pojistka
3. Automatické cross-tenant izolační testy v CI
4. Anti-quishing na resolveru (rate limit, blocklist, detekce anomálií)
5. Platby delegovány na PSP (netokáme karty), KYC delegováno na providera

## 7. RBAC a oprávnění

**Globální role v tenantu:** `OWNER` › `ADMIN` › `MANAGER` › `EDITOR` › `VIEWER` › `SCAN_ONLY`

**Per-objektové ACL** (`ObjectPermission`): `owner` / `manage` / `edit` / `view` / `scan_only` – na úrovni user/group/celý tenant, s volitelnou expirací. Backend u každého endpointu ověřuje globální právo NEBO ACL na objektu.

## 8. Moduly

### Retail skupina
- **Product** – produktová karta (složení, původ, návody), budoucí GS1 Digital Link
- **Loyalty** – věrnostní program, body, kupony
- **Payment** – Scan & Pay (Qerko-like), delegováno na PSP
- **Inventory** – sklad, inventura přes sken
- **Trace** – šarže, expirace, DPP (EU Digital Product Passport), recyklace
- **Membership** – klubové/nákupní členství: karty QR/NFC, tiery + platnost, vstup do zón, slevy / služby zdarma / speciální cena (tenká entitlement vrstva – deleguje na Access Control, Payment, Loyalty)

### Průřezové schopnosti
- **Access Control** – sdílené řízení vstupu (scan → ověř nárok → povol/odmítni → zaloguj); používá **Ticketing** i **Membership** (ADR-0006, `reference/access-control.md`)
- **Billing** – opakované předplatné (recurring přes Stripe), řídí platnost členství; deleguje dunning/fakturaci/daně na PSP, zdroj pravdy = webhooky. Dva toky: člen→tenant (Connect) a tenant→Tagery (fee za vydané karty). (ADR-0007, `reference/billing.md`)

### Events skupina
- **Ticketing** – prodej vstupenek, QR/NFC ticket, check-in u vchodu (paid → redeemed)
- **Shared Gallery** – sdílené galerie z akcí, upload přes QR, retence + moderace

### IoT
- **Automation** – QR/NFC spouští scény (webhook, http, open_url, os_shortcut, send_message, start_timer)

### Marketplace skupina
- **Rental** – půjčování věcí (**detail viz §9**)
- **Time & Event Tracking** – docházka (clock in/out), návyky, Pomodoro, parkování
- **Contact** – digitální vizitky (vCard)

## 9. Rental modul – detail (ověření + hodnocení)

Vlajkový modul marketplace fáze. Kromě půjčování řeší **ověření nájemce** a **oboustrannou reputaci jako Uber/Bolt**.

**Entity:** `Item` (věc, `required_verification_level`, kauce, ceník) · `Loan` (tenant-scoped půjčka) · `ConditionReport` (stav při výdeji/vrácení + fotky) · `RenterProfile` (**platformová** identita nájemce) · `IdentityVerification` · `RentalReview`.

**Ověření nájemce – stupňovité:**
| Úroveň | Co | Jak |
|---|---|---|
| `contact` | e-mail/telefon | OTP (default) |
| `document` | doklad | upload šifrovaně (u dražších věcí) |
| `full_kyc` | plná KYC | 3rd-party provider (post-MVP) |

Ověří se **jednou platformově**, tenant určuje jen minimální požadovanou úroveň per věc.

**Hodnocení – Uber/Bolt model:**
- Oboustranné (pronajímatel ↔ nájemce), 1–5 hvězd
- **Rolling average**, **anonymizovaná** jednotlivá hodnocení
- **Double-blind reveal** (anti-odveta)
- **Prahy s důsledky** (nájemce pod prahem lze blokovat)
- Reputace **přenositelná napříč tenanty** (platform-shared, se souhlasem nájemce)

**Tok:** žádost → `pending_verification` → ověření → výdej + kauce (`active`) → vrácení + vypořádání (`returned`) → okno oboustranného hodnocení.

## 10. Fabrication & Provisioning (produkce a aktivace nosičů)

Průřezová funkce jádra nad `DataCarrier` – mění digitální nosič ve fyzicky použitelný. Dvě větve:

**A) Export výrobních souborů (offline):**
- **Tisk štítků** → PDF (CMYK, bleed) / PNG @300 DPI / SVG / ZPL / EPL
- **Gravírka** → SVG / DXF / G-code
- **3D tisk** → STL / 3MF / STEP (+ NFC kapsa)
- Zdroj pravdy = vektorové SVG z QR matice; render asynchronně (fronta jobů)

**B) NFC provisioning z telefonu (interaktivní):**
- Aplikace **fyzicky naprogramuje NFC čip** přímo z telefonu (bez externího HW): zápis NDEF (resolver URL) → read-back verifikace → volitelný lock/heslo (anti-tamper) → spárování `nfc_uid` s nosičem, vše auditované
- **Platformová podpora:** Web NFC zápis jen Android (Chrome); iOS potřebuje nativní/PWA-most, nebo v1 Android-only. QR vždy fallback
- Zápis běží na klientu; backend eviduje výsledek + audit

Entity: `FabricationTemplate`, `FabricationJob`, `NfcProvisioningRecord` (vše tenant-scoped). Detail: `reference/fabrication.md`.

## 11. Webové UI (funkční požadavky)

Mobile-first, desktop pro pohodlnou práci. Hlavní sekce:
1. **Dashboard** – statistiky, skeny podle modulů, poslední aktivita
2. **Repository/Objects** – listing + detail (data, nosiče, modulová karta, oprávnění, analytika)
3. **Carriery** – přehled QR/NFC, generování/export, NFC párování
4. **Moduly** – správa dle zapnutých modulů
5. **Team & Roles** – uživatelé, skupiny, invite flow
6. **Settings** – branding, výchozí nastavení modulů

## 12. Nefunkční požadavky (NFR)

| Kategorie | Cíl |
|---|---|
| Resolver p95 (cache hit) | < 100 ms |
| API p95 (čtení) | < 300 ms |
| Sken throughput | 1 000 req/s (horizontální škálování) |
| Uptime resolveru | 99.9 % |
| Izolace tenantů | Zero cross-tenant leak |
| GDPR | Výmaz, retence, souhlas (galerie, KYC) |
| Přístupnost | WCAG 2.1 AA (veřejné stránky) |
| i18n | CS + EN od v1 |
| Observability | OpenTelemetry, per-tenant metriky |

## 13. Roadmapa (15 EPIKů ve 3 fázích)

> Číslo EPICu = ID (pořadí vzniku); **exekuční pořadí řídí závislosti**.

**Fáze 0 – Základy:** EPIC-00 Foundation → EPIC-01 Auth → EPIC-03 Core-Domain
**Fáze 1 – Jádro + Resolver:** EPIC-04 Digital-Object → EPIC-05 Resolver → EPIC-06 RBAC-ACL → EPIC-02 Fabrication → EPIC-07 Analytics
**Fáze 2 – MVP moduly (dle hodnoty):** Product → Access-Control → Ticketing → Rental → Gallery → Billing → Membership → Time-Tracking → Automation → Contact
**Fáze 3 – Post-MVP:** Loyalty, plné platby, Inventory, Trace/DPP, GS1, SAML SSO, custom domény, billing, PWA, veřejné API + webhooky

**Definition of Done (každý EPIC):** konvence + `stages/` checklisty · testy vč. izolačních · OpenAPI dle `reference/api-contracts.md` · aktualizace AS IS dokumentace · `PICKUP.md`.

## 14. MVP (první hmatatelná verze)

Core (Tenant/User/Location, DigitalObject, DataCarrier, ScanEvent, Resolver) + RBAC/ACL + zjednodušené moduly (Product, Ticketing, Rental, Gallery, Time, Automation, Contact) + admin UI + základní analytika.

## 15. Otevřené otázky (k rozhodnutí)

1. ~~Cloud provider~~ → **Cloudflare edge + kontejnerový backend** (ADR-0008); zbývá vybrat host (Fly/Railway/VPS)
2. PSP → **Stripe** (ADR-0007)
3. ~~Úložiště médií~~ → **Cloudflare R2** + CDN (ADR-0008)
4. Rozsah v1 SSO (OAuth2 vs. hned SAML)
5. Doménová strategie (path/subdoména vs. custom domény per tenant)
6. **Rental:** řešení sporů (damage vs. deposit) a moderace difamace u sdílené reputace
7. **NFC provisioning:** podpora iOS – nativní appka / PWA-most, nebo v1 jen Android (Web NFC)?
8. **Billing pricing (ADR-0007):** pásma a cena za vydanou kartu · účtovatelná jednotka „vydaná" vs. „aktivní" karta (business TBD, neblokuje)

---

### Mapa dokumentace
- Produkt (proč/co): `PRD.md`
- Architektura + ADR: `architecture/README.md`, `architecture/decisions/`
- API: `reference/api-contracts.md` · QR/NFC: `reference/README.md` · Fabrication: `reference/fabrication.md`
- Moduly: `modules/{retail,events,iot,marketplace}/`
- Plán a úkoly: `tasks/ROADMAP.md`, `tasks/EPIC-*/`
- Pravidla pro agenty: `../CLAUDE.md`, `../CONTEXT.md`, `_config/shared/`
