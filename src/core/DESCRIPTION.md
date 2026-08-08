# src/core – Popis

## Co tento kód dělá
Jádro Tagery platformy – společná funkcionalita sdílená napříč všemi moduly.

> Pozn.: reálná implementace žije v `apps/api/src/core/` (monorepo, EPIC-00+). Tento adresář je historický placeholder ze specifikační fáze.

## Klíčové podsložky (apps/api/src/core/)
- `auth/` – **implementováno (EPIC-01, TASK-01-JWT)**: JWT access+refresh s rotací a reuse detekcí, `JwtAuthGuard`, `@CurrentUser()`/`@TenantId()` dekorátory, Argon2id hashování, entity `User` + `RefreshToken`
- `database/` – TypeORM datasource, `BaseTenantEntity` (EPIC-00)
- `redis/` – sdílený Redis klient (EPIC-00)
- `storage/` – `StoragePort` abstrakce (local; R2/S3 později – ADR-0008)
- `tenancy/` – **implementováno (EPIC-03)**: `TenantContextService` (AsyncLocalStorage) + `TenantTransactionInterceptor` (`SET LOCAL app.tenant_id` z JWT). PostgreSQL RLS izolace, runtime role `tagery_app` (NE-superuser)
- `domain/` – **implementováno (EPIC-03+04)**: entity Tenant/Location/Group/GroupMember + DigitalObject/DataCarrier + ScanEvent; CRUD Locations/Objects/Carriers nad RLS; `public_code` generátor, QR (SVG/PNG), NFC párování, `ModuleRegistry` + `handleScan` kontrakt
- `resolver/` – **implementováno (EPIC-05)**: veřejný `GET /r/{public_code}` (mimo /api/v1), Redis cache, validace platnosti, rate limit (anti-quishing), async ScanEvent. Lookup/zápis mimo RLS přes `SECURITY DEFINER` funkce `resolve_carrier`/`log_scan`

## Exportované API
- `AuthService`, `JwtAuthGuard` (globální AuthModule)
- `@CurrentUser()`, `@TenantId()` param dekorátory

## Kritické závislosti
- Každá tenant-scoped entita dědí z `BaseTenantEntity` (obsahuje `tenant_id`)
- `tenant_id` se bere výhradně z JWT (ADR-0001)
