# Tagery – Kontinuita sessions

## Poslední session
- **Datum:** 2026-07-28
- **Agent:** Claude (Opus 4.8)
- **Dokončeno:** **EPIC-00-FOUNDATION implementován a ověřen.** Monorepo (pnpm + turbo): `apps/api` (NestJS 11), `apps/web` (Next 15), `packages/shared`. Předtím: ADR-0008 (Cloudflare edge deployment).

## Stav projektu
- **Specifikace:** kompletní (PRD, 8 ADR, moduly, roadmapa 18 EPIKů).
- **Kód:** EPIC-00 hotový. Ověřeno: build/typecheck/lint/test zeleně, Postgres+Redis přes Compose, migrace+revert+seed, `GET /api/v1/health` → 200 (`database: up, redis: up`).
- **Git:** větev `epic-00-foundation` (odbočeno z `main`). Commity: c001caf (spec), b00f7a9 (ADR-0008), + EPIC-00 skeleton.

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
**EPIC-01-AUTH** (JWT access+refresh, guard plnící tenant context) → pak **EPIC-03-CORE-DOMAIN** (Tenant/User/Location + RLS). Spec: `tasks/EPIC-01-AUTH/`. Exekuční pořadí viz `tasks/ROADMAP.md`.
Případně nejdřív mergnout `epic-00-foundation` do `main`.

## Otevřené otázky (neblokují; PRD §9 / ZADANI §15)
Kontejnerový host (Fly/Railway/Hetzner) · managed Postgres/Redis (Neon+Upstash) · SSO rozsah · doménová strategie · NFC iOS · Billing pricing pásma · Rental spory.

## Konvence
- EPIC číslo = ID (pořadí vzniku); exekuční pořadí řídí ROADMAP.
- Backlog: sjednotit `Member`/`Customer`/`RenterProfile` → `Party`/`Person`.
- Storage přes `StoragePort` (lokálně filesystem, prod R2/S3 – ADR-0008).
