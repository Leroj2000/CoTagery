# Tagery – Kontinuita sessions

## Poslední session
- **Datum:** 2026-07-21
- **Agent:** Claude (Opus 4.8)
- **Dokončeno:** Kompletní specifikační vrstva. Přidány moduly **Membership** + průřezové schopnosti **Access Control** a **Billing**. Rozhodnuty ADR 0001–0007.

## Stav projektu
**Fáze: specifikace HOTOVA, kód zatím žádný.** `src/` obsahuje jen DESCRIPTION.md placeholdery. Dokumentace je konzistentní a připravená k zahájení implementace.

## Kde číst (hlavní vstupní body)
- **`docs/ZADANI.md`** – konsolidované zadání celého projektu (nejlepší start ke čtení)
- `docs/PRD.md` – produkt, NFR, rizika, otevřené otázky
- `docs/architecture/README.md` + `decisions/0001–0007` – architektura a ADR
- `docs/reference/` – `api-contracts.md`, `access-control.md`, `billing.md`, `fabrication.md`, `README.md`
- `docs/modules/{retail,events,iot,marketplace}/` – moduly
- `tasks/ROADMAP.md` – 18 EPIKů ve 3 fázích, exekuční pořadí
- `CLAUDE.md` + `CONTEXT.md` – pravidla a směrovač pro agenty

## Další krok
Zahájit **EPIC-00-FOUNDATION**: monorepo (NestJS `apps/api` + Next.js `apps/web` + `packages/shared`), Docker Compose (Postgres, Redis), migrace + seed, CI/CD skeleton, lint/format. Spec: `tasks/EPIC-00-FOUNDATION/spec/README.md`.

Doporučené exekuční pořadí: EPIC-00 → 01 (Auth) → 03 (Core-Domain) → 04 (Digital-Object) → 05 (Resolver) → 06 (RBAC) → 02 (Fabrication) → 07 (Analytics) → moduly.

## Otevřené otázky (neblokují start kódu; viz PRD §9 / ZADANI §15)
1. Cloud provider (AWS/GCP) – zatím Docker Compose lokálně
2. PSP: **Stripe** zvolen (ADR-0007)
3. Úložiště médií (Gallery) – S3-compatible + CDN, které
4. Rozsah v1 SSO (OAuth2 vs. SAML)
5. Doménová strategie (path/subdoména vs. custom domény)
6. NFC provisioning na iOS (nativní/PWA vs. v1 Android-only)
7. Billing pricing pásma za vydanou kartu + „vydaná" vs. „aktivní" karta (business TBD)
8. Rental: řešení sporů + moderace difamace u sdílené reputace

## Konvence číslování EPICů
Číslo = stabilní ID (pořadí vzniku). Exekuční pořadí řídí závislosti v ROADMAP, ne číslo.

## Backlog poznámky
- Sjednotit `Member` / `Customer` / `RenterProfile` do společného `Party`/`Person` konceptu (zatím ne).

## Změněné soubory (session 2026-07-21)
- `docs/architecture/decisions/0005` (přepsán na Uber/Bolt platform-wide), `0006` (Access Control), `0007` (Billing) – nové/přepsané
- `docs/reference/access-control.md`, `docs/reference/billing.md` – nové
- `docs/modules/retail/README.md` (§5.12 Membership), `docs/modules/marketplace/README.md` (Rental ověření+hodnocení), `docs/modules/events/README.md` (check-in přes Access Control)
- `docs/reference/fabrication.md` (§10 NFC provisioning)
- `tasks/ROADMAP.md`, `tasks/EPIC-15/16/17/spec`, `tasks/EPIC-02-FABRICATION` (NFC task)
- `docs/ZADANI.md`, `docs/PRD.md`, `CLAUDE.md`, `CONTEXT.md`, `docs/architecture/README.md`
