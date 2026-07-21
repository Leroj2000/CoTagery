# Tagery – Ústava projektu (Vrstva 0)

## Identita projektu
Tagery je **multi-tenant SaaS platforma** pro správu dynamických QR kódů a NFC tagů. Každý kód vede na „digitální objekt", který obsluhuje jeden z modulů (product, ticketing, rental, gallery, time tracking, automation, contact). Platforma funguje v B2B/marketplace režimu – tenant je firma, která spravuje objekty a přidává uživatele s rolemi.

## Technologický stack
- **Frontend:** Next.js 14+ (App Router, SSR/SPA hybrid), TypeScript, Tailwind CSS, mobile-first
- **Backend:** NestJS, TypeScript, REST API (budoucí GraphQL)
- **Databáze:** PostgreSQL – relační schéma + JSONB pro flexibilní metadata
- **Auth:** JWT, připraveno na OAuth2 / SSO
- **Hosting:** Cloud (AWS / GCP / Azure), multi-tenant architektura

## Konvence pojmenování
- Soubory: `kebab-case`
- Komponenty: `PascalCase`
- Funkce/proměnné: `camelCase`
- DB tabulky: `snake_case`, každá musí mít `tenant_id`
- API URL: `/api/v1/kebab-case`, množné číslo pro kolekce
- Moduly: prefixovány podle domény

## Moduly platformy
| Modul | Složka | Use-case |
|---|---|---|
| Product | `docs/modules/retail/` | Produktové karty, GS1, složení, původ |
| Loyalty | `docs/modules/retail/` | Věrnostní program, body, kupony |
| Payment | `docs/modules/retail/` | Scan & Pay, Qerko-like platby |
| Inventory | `docs/modules/retail/` | Sklad, inventura, evidenční kódy |
| Trace | `docs/modules/retail/` | Šarže, DPP, compliance, recyklace |
| Membership | `docs/modules/retail/` | Klubové/nákupní členství, tiery, karty, benefity, vstup do zón |
| Ticketing | `docs/modules/events/` | Vstupenky, check-in, eventy |
| Shared Gallery | `docs/modules/events/` | Sdílené galerie fotek/videí z akcí |
| Automation | `docs/modules/iot/` | Scény spouštěné QR/NFC, webhooky |
| Rental | `docs/modules/marketplace/` | Půjčování věcí, stavy, smlouvy |
| Contact | `docs/modules/marketplace/` | Digitální vizitky |
| Time Tracking | `docs/modules/marketplace/` | Docházka, návyky, Pomodoro |

## Kritická pravidla (NIKDY neporušovat)
1. **Každý SQL dotaz musí obsahovat `tenant_id`** – viz `_config/shared/tenancy_rules.md`
2. `tenant_id` vždy z JWT, nikdy z URL nebo request body
3. Data tenantů jsou přísně izolována – žádné cross-tenant dotazy
4. Všechny API endpointy vyžadují autentizaci (kromě `GET /r/{public_code}`)
5. Mobile-first UI – viz `_config/shared/ui_design_system.md`

## Navigace v projektu
- Produktové zadání (proč/co) → `docs/PRD.md`
- Architektonická rozhodnutí → `docs/architecture/decisions/` (ADR)
- Roadmapa a EPICy → `tasks/ROADMAP.md`
- Aktuální stav systému → `docs/`
- Plánované změny → `tasks/`
- Agentní workflow → `stages/`
- Zdrojový kód → `src/`
- Globální pravidla → `_config/shared/`
- Směrování úkolů → `CONTEXT.md`
- Stav session → `PICKUP.md`
