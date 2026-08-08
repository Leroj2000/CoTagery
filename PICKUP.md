# Tagery – Kontinuita sessions

## Poslední session
- **Datum:** 2026-08-08
- **Agent:** Claude (Opus 4.8)
- **Dokončeno:** **EPIC-05 Resolver implementován a ověřen.** Veřejný `GET /r/{public_code}` (mimo /api/v1), Redis cache, validace platnosti (404/410), content negotiation (JSON/302 redirect), rate limit (anti-quishing), async ScanEvent. Lookup/zápis mimo RLS přes `SECURITY DEFINER` funkce `resolve_carrier`/`log_scan`. Předtím: EPIC-04, EPIC-03 (RLS), EPIC-01, EPIC-00.

## Stav projektu
- **Specifikace:** kompletní (PRD, 8 ADR, moduly, roadmapa 18 EPIKů).
- **Kód na `main`:** EPIC-00, EPIC-01, EPIC-03 (RLS), EPIC-04. **EPIC-05** na větvi `epic-05-resolver` (nezmergováno).
- **Ověřeno (EPIC-05):** build/typecheck/lint/test zeleně (15 testů); migrace InitResolver; e2e — JSON resolve, 302 redirect, 404, 410 (archived), ScanEvent zápis, rate limit (116×200 + 14×429).
- **Git:** větev `epic-05-resolver` z `main`.
- **Follow-upy EPIC-05 (dokumentované):** cache write-invalidation (teď TTL 20 s), durable ScanEvent fronta + idempotence (teď fire-and-forget), degradace na read-replica.
- **KRITICKÉ pozn. k RLS:** runtime přes `APP_DATABASE_URL` jako `tagery_app` (NE-superuser). `.env` musí mít `APP_DATABASE_URL` + `JWT_SECRET` (viz `.env.example`). **Migrace před startem appky.**

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
Mergnout `epic-05-resolver` do `main`, pak **EPIC-06 Analytics** (agregace ScanEvent, dashboard přehledy – tenant-scoped čtení `scan_events`) nebo začít **Fáze 2 moduly** (EPIC-08 Product jako první, registruje se přes `ModuleRegistry.handleScan`). Volitelně doplnit follow-upy resolveru (cache invalidace, durable fronta) a zbytek EPIC-03/EPIC-01.

## Otevřené otázky (neblokují; PRD §9 / ZADANI §15)
Kontejnerový host (Fly/Railway/Hetzner) · managed Postgres/Redis (Neon+Upstash) · SSO rozsah · doménová strategie · NFC iOS · Billing pricing pásma · Rental spory.

## Konvence
- EPIC číslo = ID (pořadí vzniku); exekuční pořadí řídí ROADMAP.
- Backlog: sjednotit `Member`/`Customer`/`RenterProfile` → `Party`/`Person`.
- Storage přes `StoragePort` (lokálně filesystem, prod R2/S3 – ADR-0008).
