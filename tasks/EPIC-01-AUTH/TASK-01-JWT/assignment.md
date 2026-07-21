# TASK-01-JWT – Zadání

## Popis
Implementovat autentizaci založenou na JWT: krátký access token + rotující refresh token, včetně NestJS guardu, který na každý request naplní request context `tenant_id`, `user_id`, `tenant_role` z ověřeného tokenu.

## Vstupy
- Entity `User` a `Tenant` (z EPIC-02-CORE-DOMAIN – pokud ještě nejsou, stub s in-memory/seed)
- `docs/architecture/README.md` – auth sekce, tvar JWT payloadu
- ADR-0001 – `tenant_id` vždy z JWT
- `_config/shared/tenancy_rules.md`

## Výstupy
- `POST /api/v1/auth/login` → access + refresh token
- `POST /api/v1/auth/refresh` → rotace refresh tokenu, nový access
- `POST /api/v1/auth/logout` → revokace refresh tokenu
- `JwtAuthGuard` + `@CurrentUser()` / `@TenantId()` dekorátory
- Testy (unit + integration)

## Omezení
- Access token TTL ≤ 15 min; refresh token TTL ~30 dní, **rotace při každém použití**.
- Refresh tokeny revokovatelné (uložení hash+jti v DB / Redis, blacklist na logout).
- Payload: `{ sub: userId, tenantId, tenantRole, jti, iat, exp }`.
- Hesla: Argon2id (ne bcrypt) pokud řešíme i credentials login.
- Secret přes env/secret manager, nikdy v kódu.

## Relevantní soubory (po implementaci)
- `src/core/auth/` – guardy, strategie, dekorátory, service
- `src/core/DESCRIPTION.md` – aktualizovat
