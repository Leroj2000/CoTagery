# Tagery – Kontinuita sessions

## Poslední session
- **Datum:** 2026-08-10
- **Agent:** Claude (Opus 4.8)
- **Dokončeno:** **EPIC-16 Membership** (naplno) + **EPIC-17 Billing** (stub PSP) + **RBAC role-guard** follow-up + **frontend** scan/aktivace. Vše na `main`.
  - Membership: Member, MembershipTier (platnost+grace+zóny), Membership, MembershipCard (↔ DataCarrier), MembershipBenefit; entitlement provider pro vstup do zón (Access-Control) + scan handler (self-service karta).
  - Billing (stub): BillingCustomer, Subscription, Invoice, BillingWebhookEvent, PlatformUsageMeter; checkout → (stub) předplatné; veřejný webhook (HMAC podpis + idempotence + `billing_subscription_lookup` SECURITY DEFINER) řídí lifecycle členství (invoice.paid→renew, payment_failed→grace, deleted→cancel); DPH 21 %/reverse-charge; metering karet (Tok 2); customer portal. `StubPspService` → vyměnit za Stripe adaptér (ADR-0007).
  - RBAC: `RolesGuard` + `@RequireRole` (hierarchie SCAN_ONLY<VIEWER<EDITOR<MANAGER<ADMIN<OWNER) na write endpointech napříč moduly (obsah→EDITOR, peníze/trust→MANAGER, ACL→ADMIN).
  - Frontend (apps/web): `/s/[code]` modul-aware scan view (členská karta/produkt/unassigned/404-410), `/activate/[code]` PIN formulář → `POST /r/{code}/activate`.

## Stav projektu
- **Specifikace:** kompletní (PRD, 8 ADR, moduly, roadmapa 18 EPIKů).
- **Kód na `main`:** EPIC-00–11, 15, **16, 17** (+ pool/claim + self-aktivace). Vše zmergováno.
- **Ověřeno:** typecheck/lint/build zeleně; **40 unit testů**; 15 migrací (poslední `1800-InitBilling`). E2E proti DB (membership+billing): checkout→gate deny→invoice.paid(signed)→gate allow; idempotence (duplicate); špatný podpis→401; špatná zóna→deny; VAT rozpad; usage meter. RBAC runtime: VIEWER→403, OWNER→201, EDITOR na MANAGER endpoint→403. Frontend: obě routy 200, membership scan vrací kartu.
- **Git:** vše na `main` (merge `epic-16-17`). Feature větev `epic-16-17-membership-billing` lze smazat.
- **KRITICKÉ pozn. k RLS:** runtime přes `APP_DATABASE_URL` jako `tagery_app` (NE-superuser). `.env` musí mít `APP_DATABASE_URL` + `JWT_SECRET` + volitelně `BILLING_WEBHOOK_SECRET` (viz `.env.example`). **Migrace před startem appky.**

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
Reálná **Stripe integrace** místo `StubPspService` (ADR-0007) – adaptér s Connect onboardingem (Tok 1) + usage report do Stripe (Tok 2, tabulka `platform_usage_meters` připravená). Pak zbývající follow-upy níže.

## Nevyřešené úkoly (backlog)
- ✅ **Veřejná self-aktivace (PIN)** – HOTOVO. Aktivační HTML stránka i HOTOVO (`apps/web/app/activate/[code]`). Follow-up: doručení PINu přes SMS, edit-token authed edit endpointy. Spec: `tasks/FEAT-public-self-activation/`.
- ✅ **EPIC-16 Membership + EPIC-17 Billing (stub)** – HOTOVO na `main`. Zbývá: reálné Stripe (viz Další krok).
- ✅ **RBAC guard wiring do mutačních endpointů** – HOTOVO (`RolesGuard` + `@RequireRole`).
- ✅ **Frontend scan/aktivace** – HOTOVO (`/s/[code]`, `/activate/[code]`).
- ✅ **Admin frontend – fáze 1 (auth + shell)** – HOTOVO. httpOnly JWT přes **BFF** (Next route handlery + middleware, token nikdy v JS, API beze změn). `/login`, `/admin` shell (layout s /me topbarem + logout, sidebar nav). Klíčové soubory: `apps/web/app/lib/{session,server-api,jwt}.ts`, `apps/web/app/api/auth/*`, `apps/web/middleware.ts`, `apps/web/app/admin/*`.
- ✅ **Admin frontend – fáze 2 (obsahové obrazovky)** – HOTOVO. Server-rendered obrazovky + **Server Actions** pro mutace (revalidatePath). `/admin/objects` (objekty + batch nosiče), `/admin/membership` (tiery/členové/vydání), `/admin/billing` (předplatná/metering/checkout), `/admin/access` (přístupové body), `/admin/users` (seznam + invite, ADMIN+). Sdílené UI: `apps/web/app/admin/{ui.tsx,action-form.tsx,actions.ts,options.ts}`.
- ✅ **EPIC-03/01 backend (částečně)** – User CRUD + invite (`core/domain/users`), Group CRUD (`core/domain/groups`), members/subscriptions list. **Zbývá:** OAuth2/SSO, e-mailová invite (teď temp heslo), Tenant CRUD, set-password flow, group ↔ ACL propojení.
- ✅ **Admin frontend – fáze 3 (detaily + dashboard + user mgmt)** – HOTOVO. Dashboard analytics (`/analytics/overview`), `/admin/objects/[id]` (nosiče + QR náhled přes BFF proxy `/api/qr/[carrierId]`, přidání nosiče, archivace), `/admin/billing/[id]` (faktury + zrušení + PSP portál), `/admin/access/[id]` (audit log), inline změna role + suspend/activate na `/admin/users`. Sdílené `action-button.tsx`, hidden pole v `ActionForm`.
- ✅ **Admin frontend – fáze 4 (karty, pool, skupiny)** – HOTOVO. `/admin/membership` „Vydat kartu" (členství+nosič) + tabulka členství (backend GET /memberships doplněn); `/admin/carriers` (nová) generování poolu vč. self-aktivace (PIN k tisku), seznam nepřiřazených, claim na objekt; `/admin/groups` (nová) CRUD skupin + členů. Nové akce v `actions.ts`.
- ✅ **Admin frontend – fáze 5 (nastavení, NFC, benefity, graf)** – HOTOVO. Tenant GET/PATCH backend (`core/domain/tenant`) + `/admin/settings`; NFC pairing inline na object detail; benefit management na `/admin/membership`; CSS bar-graf skenů na dashboardu; `ActionForm` podporuje `defaultValue`.
  - **Fáze 6+ (TODO admin):** grafy s časovou řadou skenů (`/analytics/scans`), benefit delete/edit, location management UI (backend LocationsController hotový), rental/gallery/ticketing obrazovky, self-activation edit-token flow (authed edit endpointy chybí).
- Drobné/otevřené: OAuth2/SSO + e-mailová invite (SMTP, teď temp heslo); doručení PINu přes SMS; edit-token authed edit endpointy; resolver cache-invalidace + durable ScanEvent fronta; Fabrication async/gravírka/3D/NFC provisioning.

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
