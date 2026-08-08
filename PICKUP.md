# Tagery – Kontinuita sessions

## Poslední session
- **Datum:** 2026-08-08
- **Agent:** Claude (Opus 4.8)
- **Dokončeno:** **EPIC-03 Core-Domain – RLS izolace tenantů implementována a ověřena.** Entity Tenant/Location/Group/GroupMember, per-request tenant kontext (`SET LOCAL app.tenant_id` z JWT přes interceptor + AsyncLocalStorage), PostgreSQL RLS (enable+force+policy), runtime NE-superuser role `tagery_app`, Locations CRUD, izolační e2e test. Předtím: EPIC-01 Auth, EPIC-00, ADR-0008.

## Stav projektu
- **Specifikace:** kompletní (PRD, 8 ADR, moduly, roadmapa 18 EPIKů).
- **Kód:** EPIC-00 + EPIC-01 na `main`. **EPIC-03 RLS** na větvi `epic-03-core-domain` (nezmergováno). EPIC-03 zbývá: plné CRUD Tenant/User/Group.
- **Ověřeno (EPIC-03):** build/typecheck/lint/test zeleně (7 testů); migrace InitCoreDomain (locations/groups/group_members + RLS + role); **izolace: tenant A nevidí data B** (API 404 + DB-level 1/0 řádků).
- **Git:** větev `epic-03-core-domain` z `main`.
- **KRITICKÉ pozn. k RLS:** runtime aplikace se připojuje přes `APP_DATABASE_URL` jako `tagery_app` (NE-superuser, jinak superuser RLS obchází). Do `.env` nutno přidat `APP_DATABASE_URL` (je v `.env.example`). Migrace vytváří roli `tagery_app` → **migrace musí proběhnout před startem appky** (jinak se `tagery_app` nemá kam připojit).

## Jak spustit (dev)
```
cp .env.example .env
pnpm install
docker compose up -d postgres redis
pnpm --filter @tagery/api migration:run
pnpm --filter @tagery/api seed
pnpm dev            # nebo: pnpm --filter @tagery/api dev
# health: curl http://localhost:3001/api/v1/health
```
pnpm se instaluje přes `npm i -g pnpm@9` (corepack v tomto prostředí nebyl).

## Další krok
Mergnout `epic-03-core-domain` do `main`, pak **EPIC-04 Digital-Object** (DigitalObject + DataCarrier + QR/NFC) → **EPIC-05 Resolver**. Volitelně doplnit zbytek EPIC-03 (Tenant/User/Group CRUD) a EPIC-01 (OAuth2, invite) později.

## Otevřené otázky (neblokují; PRD §9 / ZADANI §15)
Kontejnerový host (Fly/Railway/Hetzner) · managed Postgres/Redis (Neon+Upstash) · SSO rozsah · doménová strategie · NFC iOS · Billing pricing pásma · Rental spory.

## Konvence
- EPIC číslo = ID (pořadí vzniku); exekuční pořadí řídí ROADMAP.
- Backlog: sjednotit `Member`/`Customer`/`RenterProfile` → `Party`/`Person`.
- Storage přes `StoragePort` (lokálně filesystem, prod R2/S3 – ADR-0008).
