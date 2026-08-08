# Tagery – Kontinuita sessions

## Poslední session
- **Datum:** 2026-08-08
- **Agent:** Claude (Opus 4.8)
- **Dokončeno:** **EPIC-07 Analytics + EPIC-08 Product implementovány a ověřeny.** Analytics: `/analytics/overview` + `/analytics/scans` (tenant-scoped nad RLS). Product: první modul s `handleScan` — `ProductHandler` se registruje do `ModuleRegistry`, resolver ho spouští v tenant kontextu (`runInTenant`), sken product objektu vrací produktovou kartu. Refaktor: `TenantContextService.runInTenant` (sdílí interceptor i resolver). Předtím: EPIC-05 Resolver, EPIC-04, EPIC-03 (RLS), EPIC-01, EPIC-00.

## Stav projektu
- **Specifikace:** kompletní (PRD, 8 ADR, moduly, roadmapa 18 EPIKů).
- **Kód na `main`:** EPIC-00, 01, 03, 04, 05, 07. **EPIC-08** na větvi `epic-08-product` (nezmergováno).
- **Ověřeno (EPIC-07/08):** build/typecheck/lint/test zeleně (15 testů); migrace InitProduct; e2e — analytics overview/scans + izolace (B=0); sken product nosiče → JSON karta z handleScan.
- **Git:** větev `epic-08-product` z `main`.
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
Mergnout `epic-08-product` do `main`. Pak další Fáze 2 moduly podle vzoru Product (entita + migrace RLS + handler registrovaný do ModuleRegistry): **EPIC-09 Ticketing** (+ EPIC-15 Access-Control), **EPIC-10 Rental**, atd. Nebo EPIC-06 RBAC-ACL / EPIC-02 Fabrication. Follow-upy resolveru (cache invalidace, durable fronta) a zbytek EPIC-03/EPIC-01 volitelně.

## Vzor pro nový modul (podle EPIC-08 Product)
1. Entita extends `BaseTenantEntity` + migrace (ENABLE+FORCE RLS + policy + GRANT tagery_app)
2. Service přes `TenantContextService.manager`
3. Handler implements `ModuleHandler` + `OnModuleInit` → `registry.register(this)`; `handleScan` čte přes scoped manager (resolver ho volá v `runInTenant`)
4. Modul importuje `DomainModule` (ModuleRegistry) + `TypeOrmModule.forFeature([Entita])`; zaregistrovat v `app.module.ts`

## Otevřené otázky (neblokují; PRD §9 / ZADANI §15)
Kontejnerový host (Fly/Railway/Hetzner) · managed Postgres/Redis (Neon+Upstash) · SSO rozsah · doménová strategie · NFC iOS · Billing pricing pásma · Rental spory.

## Konvence
- EPIC číslo = ID (pořadí vzniku); exekuční pořadí řídí ROADMAP.
- Backlog: sjednotit `Member`/`Customer`/`RenterProfile` → `Party`/`Person`.
- Storage přes `StoragePort` (lokálně filesystem, prod R2/S3 – ADR-0008).
