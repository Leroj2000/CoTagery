# Tagery – Kontinuita sessions

## Poslední session
- **Datum:** 2026-08-09
- **Agent:** Claude (Opus 4.8)
- **Dokončeno:** **Feature: veřejná self-aktivace (PIN)** nad pool/claim — `POST /r/{code}/activate` (bez JWT, rate-limited), batch se `selfActivatable`+PIN (argon2 hash, plaintext k tisku), `activation_lookup` SECURITY DEFINER, edit-token. Předtím: pre-printed pool + claim; EPIC-06 RBAC + EPIC-02 Fabrication; vše ostatní na main.

## Stav projektu
- **Specifikace:** kompletní (PRD, 8 ADR, moduly, roadmapa 18 EPIKů).
- **Kód na `main`:** EPIC-00, 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 15 (13 EPIKů). **Feature unassigned-carriers** na větvi `feat-unassigned-carriers` (nezmergováno).
- **Ověřeno (pool/claim):** build/typecheck/lint/test zeleně (20 testů); migrace UnassignedCarriers; e2e — batch generate → sken unassigned → claim → resolve; izolace (B claim kódu A → 404); dvojitý claim → 400.
- **Git:** větev `feat-unassigned-carriers` z `main`. 12 migrací (13. = UnassignedCarriers na větvi).
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
Mergnout `epic-02-fabrication` do `main`. Zbývá z navržených: **EPIC-16 Membership + EPIC-17 Billing** (Billing čeká na rozhodnutí PSP – Stripe/ADR-0007, nebo stub). Dále follow-upy: RBAC guard wiring do mutačních endpointů, resolver cache invalidace + durable ScanEvent fronta, Fabrication async/gravírka/3D/NFC provisioning, zbytek EPIC-03 (Tenant/User/Group CRUD) a EPIC-01 (OAuth2, invite). Frontend (apps/web) je zatím jen health shell.

## Nevyřešené úkoly (backlog)
- ✅ **Veřejná self-aktivace (PIN)** – HOTOVO (`POST /r/{code}/activate`, batch se selfActivatable+PIN, edit-token). Follow-up: doručení PINu přes SMS, edit-token authed edit endpointy, aktivační HTML stránka. Spec: `tasks/FEAT-public-self-activation/`.
- EPIC-16 Membership + EPIC-17 Billing (Billing čeká na PSP rozhodnutí – Stripe/ADR-0007 vs stub).
- Frontend (apps/web) je zatím jen health shell.
- Drobné: RBAC guard wiring do mutačních endpointů; resolver cache-invalidace + durable ScanEvent fronta; Fabrication async/gravírka/3D/NFC provisioning; zbytek EPIC-03 (Tenant/User/Group CRUD) a EPIC-01 (OAuth2, invite).

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
