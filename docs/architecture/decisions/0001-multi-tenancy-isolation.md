# ADR-0001 – Model izolace tenantů

- **Stav:** Přijato
- **Datum:** 2026-07-19
- **Kontext vrstva:** 3 (neměnné mantinely)

## Kontext
Tagery je multi-tenant SaaS. Izolace dat tenantů je nejkritičtější bezpečnostní vlastnost (viz PRD §5, §8). Máme tři standardní varianty:

1. **Database-per-tenant** – nejsilnější izolace, ale drahé na provoz a migrace při tisících tenantů.
2. **Schema-per-tenant** – dobrá izolace, ale komplikované migrace a connection pooling.
3. **Shared DB, shared schema + `tenant_id`** – nejlevnější provoz, škáluje, ale izolace závisí na aplikační disciplíně.

## Rozhodnutí
Volíme **shared database, shared schema s povinným `tenant_id`**, zpevněné **PostgreSQL Row Level Security (RLS)** jako druhou obrannou linií.

Izolace je vynucena na třech vrstvách (defense in depth):
1. **Aplikace** – `tenant_id` se bere výhradně z ověřeného JWT (nikdy z URL/body) a vkládá do request contextu.
2. **ORM** – všechny entity dědí z `BaseTenantEntity`; TypeORM global scope automaticky přidává `WHERE tenant_id = :ctxTenantId`.
3. **Databáze** – RLS policy na každé tabulce vázaná na session GUC `app.tenant_id`, nastavovaný per-request/transaction.

## Důsledky
- **Pozitivní:** nejlevnější provoz, jednoduché cross-tenant reporty pro platform-admina (mimo RLS přes service role), přímočaré migrace (jedno schéma).
- **Negativní:** jediný bug v aplikaci by teoreticky mohl obejít filtr → proto RLS jako pojistka a **povinné automatické izolační testy** (Stage 04) v CI.
- **Migrační cesta:** pokud enterprise zákazník bude vyžadovat fyzickou izolaci, architektura umožní „sharding" konkrétního tenanta do vlastní DB bez změny modelu.

## Vynucení
- Lint/review pravidlo: žádný raw dotaz bez `tenant_id` (viz `_config/shared/tenancy_rules.md`).
- CI test: pokus o cross-tenant čtení musí vrátit 0 řádků / 403.
- Per-request transakce nastavuje `SET LOCAL app.tenant_id` z JWT (interceptor).

## Implementace (EPIC-03)
- **Runtime role `tagery_app` je NE-superuser** (`NOSUPERUSER NOBYPASSRLS`) → podléhá RLS. Migrace/seed běží pod vlastníkem (`tagery`); aplikace se za běhu připojuje přes `APP_DATABASE_URL`. **Superuser (výchozí `POSTGRES_USER`) RLS obchází i s FORCE** – proto oddělená role.
- Tabulky mají `ENABLE` + `FORCE ROW LEVEL SECURITY` a politiku `tenant_isolation`: `tenant_id = current_setting('app.tenant_id', true)::uuid` (chybějící kontext → NULL → 0 řádků, bezpečné odepření).
- `TenantTransactionInterceptor` + `TenantContextService` (AsyncLocalStorage) drží per-request transakci a scoped EntityManager.
- Ověřeno izolačním e2e testem: tenant A nevidí data tenantu B (API 404 + DB-level 0/1 řádek).
