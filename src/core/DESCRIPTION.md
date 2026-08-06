# src/core – Popis

## Co tento kód dělá
Jádro Tagery platformy – společná funkcionalita sdílená napříč všemi moduly.

> Pozn.: reálná implementace žije v `apps/api/src/core/` (monorepo, EPIC-00+). Tento adresář je historický placeholder ze specifikační fáze.

## Klíčové podsložky (apps/api/src/core/)
- `auth/` – **implementováno (EPIC-01, TASK-01-JWT)**: JWT access+refresh s rotací a reuse detekcí, `JwtAuthGuard`, `@CurrentUser()`/`@TenantId()` dekorátory, Argon2id hashování, entity `User` + `RefreshToken`
- `database/` – TypeORM datasource, `BaseTenantEntity` (EPIC-00)
- `redis/` – sdílený Redis klient (EPIC-00)
- `storage/` – `StoragePort` abstrakce (local; R2/S3 později – ADR-0008)
- `qr-nfc/` – generování a správa tagů (EPIC-04, zatím ne)
- `tenancy/` – RLS a tenant scope (EPIC-03, zatím ne)

## Exportované API
- `AuthService`, `JwtAuthGuard` (globální AuthModule)
- `@CurrentUser()`, `@TenantId()` param dekorátory

## Kritické závislosti
- Každá tenant-scoped entita dědí z `BaseTenantEntity` (obsahuje `tenant_id`)
- `tenant_id` se bere výhradně z JWT (ADR-0001)
