# EPIC-03-CORE-DOMAIN – Specifikace

## Cíl
Implementovat základní multi-tenant doménu a vynutit izolaci tenantů na všech třech vrstvách (ADR-0001).

## Scope

### In scope
- Entity: `Tenant`, `Location`, `User`, `Group`, `GroupMember`
- `BaseTenantEntity` s automatickým `tenant_id` scope (TypeORM global scope)
- **PostgreSQL Row Level Security** na všech tenant tabulkách + nastavení `app.tenant_id` GUC per transakce
- Request context propagace `tenant_id` z JWT (navazuje na EPIC-01)
- CRUD API: `/tenant`, `/locations`, `/users` (viz `docs/reference/api-contracts.md`)
- Seed: demo tenant + owner user

### Out of scope
- DigitalObject/DataCarrier (EPIC-04)
- Billing tenantů

## Stav: 🟡 RLS izolace hotová (2026-08-08); plné CRUD pro Tenant/User/Group zbývá

## Acceptance kritéria
- [x] RLS policy aktivní: i přímý SQL (runtime role) vrátí jen data aktuálního tenanta
- [x] **Izolační test**: tenant A dostane 404/prázdno na zdroje tenantu B (ověřeno API i DB-level)
- [x] Per-request tenant kontext (`SET LOCAL app.tenant_id` z JWT) přes interceptor + ALS
- [x] Migrace + seed reprodukovatelné; runtime NE-superuser role `tagery_app`
- [ ] Owner/Admin RBAC enforcement dle matice – EPIC-06 (ACL)
- [ ] Plné CRUD Tenant/User/Group endpointy (zatím jen Locations jako demonstrátor)

## Závislosti
- EPIC-00-FOUNDATION (skeleton, migrace)
- EPIC-01-AUTH (JWT → `tenant_id` v kontextu)

## Podúkoly
- [x] TASK-01-ENTITIES – Tenant/Location/Group/GroupMember + migrace ✅
- [x] TASK-03-RLS – RLS policies + `app.tenant_id` GUC per-request + runtime role ✅
- [~] TASK-04-TENANT-API – Locations CRUD + izolační test hotové; Tenant/User/Group CRUD zbývá
- [ ] TASK-02-BASE-ENTITY – volitelný ORM-level global scope (RLS už izoluje na DB)
