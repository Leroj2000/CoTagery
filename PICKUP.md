# Tagery – Kontinuita sessions

## Poslední session
- **Datum:** 2026-08-08
- **Agent:** Claude (Opus 4.8)
- **Dokončeno:** **EPIC-15 Access-Control + EPIC-09 Ticketing implementovány a ověřeny.** Access-Control: `AccessPoint`/`AccessEvent` (RLS), `AccessRegistry` (providers dle subjectType), `evaluate` + audit (ADR-0006). Ticketing: Event/TicketType/Ticket, `TicketEntitlementProvider` registrovaný do AccessRegistry → check-in vstupenky s redemcí. Předtím: EPIC-08 Product, EPIC-07 Analytics, EPIC-05 Resolver, EPIC-04, 03, 01, 00.

## Stav projektu
- **Specifikace:** kompletní (PRD, 8 ADR, moduly, roadmapa 18 EPIKů).
- **Kód na `main`:** EPIC-00, 01, 03, 04, 05, 07, 08. **EPIC-15 + EPIC-09** na větvi `epic-15-access-control` (nezmergováno).
- **Ověřeno (EPIC-15/09):** build/typecheck/lint/test zeleně (15 testů); migrace InitAccessControl + InitTicketing; e2e check-in — allow → deny(already_redeemed) → deny(not_found) → deny(no_provider); audit log; izolace (B čte AP od A → 404).
- **Git:** větev `epic-15-access-control` z `main` (obsahuje access-control i ticketing).
- **KRITICKÉ pozn. k RLS:** runtime přes `APP_DATABASE_URL` jako `tagery_app` (NE-superuser). `.env` musí mít `APP_DATABASE_URL` + `JWT_SECRET` (viz `.env.example`). **Migrace před startem appky.** 9 migrací.

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
Mergnout `epic-15-access-control` do `main`. Pak další Fáze 2 moduly: **EPIC-10 Rental** (ověření nájemce + hodnocení – ADR-0005 platform party), **EPIC-16 Membership** (+ EPIC-17 Billing), **EPIC-11 Gallery**, atd. Nebo EPIC-06 RBAC-ACL / EPIC-02 Fabrication. Follow-upy resolveru a zbytek EPIC-03/EPIC-01 volitelně.

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
