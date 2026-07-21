# TASK-01-JWT – Plán implementace

## Kroky
1. **Návrh úložiště tokenů** – tabulka/Redis pro refresh tokeny (`jti`, `user_id`, `tenant_id`, `hash`, `expires_at`, `revoked_at`).
2. **AuthModule** – NestJS modul: `AuthService`, `JwtStrategy`, `JwtAuthGuard`.
3. **Login** – ověření credentials (Argon2id) → vydání access + refresh.
4. **Refresh rotation** – ověř refresh, revokuj starý `jti`, vydej nový pár. Detekce reuse → revokovat celý řetězec (token theft detection).
5. **Logout** – revokace aktivního refresh tokenu.
6. **Guard + dekorátory** – `@CurrentUser()`, `@TenantId()`; guard plní request context.
7. **Napojení na tenancy** – guard nastaví `app.tenant_id` GUC pro RLS (ADR-0001).

## Testovací scénáře
- [ ] Login vrací validní pár tokenů, payload obsahuje `tenantId` a `tenantRole`.
- [ ] Expirovaný access token → 401.
- [ ] Refresh rotuje a starý refresh je neplatný.
- [ ] Reuse revokovaného refresh tokenu → revokace celého řetězce.
- [ ] Logout okamžitě zneplatní refresh.
- [ ] Request bez tokenu na chráněný endpoint → 401.
- [ ] Token tenantu A nikdy nedá přístup k datům tenantu B (izolační test).

## Po dokončení
- [ ] Aktualizovat `src/core/DESCRIPTION.md` (auth submodul)
- [ ] Promítnout auth flow do `docs/architecture/README.md` a `docs/reference/README.md`
- [ ] Aktualizovat `PICKUP.md`
