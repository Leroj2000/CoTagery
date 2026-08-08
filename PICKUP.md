# Tagery – Kontinuita sessions

## Poslední session
- **Datum:** 2026-08-08
- **Agent:** Claude (Opus 4.8)
- **Dokončeno:** **EPIC-10 Rental implementován a ověřen.** Půjčování + stupňovité ověření nájemce + oboustranné hodnocení s platformově sdílenou reputací (ADR-0005): `RenterProfile` mimo RLS (sdílený napříč tenanty), Item/Loan/RentalReview tenant-scoped. Předtím (vše na main): EPIC-15 Access-Control + EPIC-09 Ticketing, EPIC-08 Product, EPIC-07 Analytics, EPIC-05, 04, 03, 01, 00.

## Stav projektu
- **Specifikace:** kompletní (PRD, 8 ADR, moduly, roadmapa 18 EPIKů).
- **Kód na `main`:** EPIC-00, 01, 03, 04, 05, 07, 08, 09, 15. **EPIC-10** na větvi `epic-10-rental` (nezmergováno).
- **Ověřeno (EPIC-10):** build/typecheck/lint/test zeleně (17 testů); migrace InitRental; e2e — verification gate (400), sdílená reputace (B vidí 5.00 od A), cross-tenant update (4.00/2), izolace půjček (404).
- **Git:** větev `epic-10-rental` z `main`. 10 migrací.
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
Mergnout `epic-10-rental` do `main`. Zbývající navržené moduly: **EPIC-11 Gallery** (StoragePort/R2 upload, retence), **EPIC-16 Membership + EPIC-17 Billing** (Billing potřebuje rozhodnutí PSP – Stripe, ADR-0007; MVP lze stubovat), **EPIC-06 RBAC-ACL** (per-objektová oprávnění), **EPIC-02 Fabrication**. Vzor modulu viz níže.

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
