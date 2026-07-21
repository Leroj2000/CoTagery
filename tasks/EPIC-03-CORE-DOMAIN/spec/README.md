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

## Acceptance kritéria
- [ ] `BaseTenantEntity` automaticky filtruje podle kontextu – nelze načíst cizí tenant data
- [ ] RLS policy aktivní: i raw SQL bez filtru vrátí jen data aktuálního tenanta
- [ ] **Izolační test**: uživatel tenantu A dostane 404/prázdno na zdroje tenantu B
- [ ] Owner/Admin role fungují dle RBAC matice
- [ ] Migrace + seed reprodukovatelné

## Závislosti
- EPIC-00-FOUNDATION (skeleton, migrace)
- EPIC-01-AUTH (JWT → `tenant_id` v kontextu)

## Podúkoly (návrh)
- [ ] TASK-01-ENTITIES – Tenant/Location/User/Group + migrace
- [ ] TASK-02-BASE-ENTITY – BaseTenantEntity + TypeORM scope
- [ ] TASK-03-RLS – RLS policies + GUC per-request
- [ ] TASK-04-TENANT-API – CRUD endpointy + izolační testy
