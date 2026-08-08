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
- `resolver/` – **implementováno (EPIC-05)**: veřejný `GET /r/{public_code}` (mimo /api/v1), Redis cache, validace platnosti, rate limit (anti-quishing), async ScanEvent, spouští modulový `handleScan` v tenant kontextu. Lookup/zápis mimo RLS přes `SECURITY DEFINER` funkce
- `analytics/` – **implementováno (EPIC-07)**: `/analytics/overview` + `/scans` (tenant-scoped agregace ScanEvent)
- `access/` – **implementováno (EPIC-15)**: sdílená Access-Control (`AccessPoint`/`AccessEvent`, `AccessRegistry`, `evaluate` + audit; ADR-0006)
- (mimo core) `src/modules/product/` – **implementováno (EPIC-08)**: první modul, `ProductHandler` → `ModuleRegistry`, sken vrací produktovou kartu
- (mimo core) `src/modules/ticketing/` – **implementováno (EPIC-09)**: Event/TicketType/Ticket, `TicketEntitlementProvider` → `AccessRegistry` (check-in + redemce)

## Exportované API
- `AuthService`, `JwtAuthGuard` (globální AuthModule)
- `@CurrentUser()`, `@TenantId()` param dekorátory

## Kritické závislosti
- Každá tenant-scoped entita dědí z `BaseTenantEntity` (obsahuje `tenant_id`)
- `tenant_id` se bere výhradně z JWT (ADR-0001)
