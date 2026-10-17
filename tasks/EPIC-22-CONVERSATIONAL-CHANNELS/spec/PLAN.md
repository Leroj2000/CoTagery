# EPIC-22 – Implementační plán (průchod 1, 2026-10-15)

Větev `epic-22-conversational-channels` (worktree `/root/projects/tagery-epic22`), základ `main`.
Pořadí podle spec: jádro akcí → Telegram → MCP. Každý krok = commit se zelenými testy.

## Krok 1 – ActionRegistry + ActionExecutor (jádro)
- `apps/api/src/modules/channels/actions/`: typ `ChannelAction` (klíč, anglický popis pro AI,
  český popis, Zod vstup, `permission`, `kind: read|write`, `requiresConfirmation`, `execute`).
- Akce v1: `org.list`, `asset.search`, `asset.get`, `attention.list`, `location.search`,
  `asset.create`, `asset.move`, `issue.report` (`asset.issue`/`asset.return` – viz zbývá).
- `ActionExecutorService.execute(actor, key, input)`: aktivní členství (`my_memberships`) →
  `runInTenant` → scope + policy (stejná logika jako `TenantTransactionInterceptor`) →
  funkce kanálu (`channel_telegram` / `channel_mcp`) → `AuthzService.can` → Zod → akce →
  audit `channel.<akce>` s kanálem a maskovaným external id.
- Funkce předplatného `channel_telegram`, `channel_mcp` (PLAN_FEATURES; Zkušební + Pro).

## Krok 2 – ChannelIdentity + Telegram
- Tabulky `channel_identities`, `channel_link_codes` (hash, 10 min, jednorázový),
  `channel_conversations` (vázané na identitu + firmu, expirace 30 min),
  `channel_processed_updates` (idempotence webhooků).
- API pro web: `POST /channels/link-codes`, `GET/DELETE /channels/identities`.
- Webhook `POST /api/v1/channels/telegram/webhook/:secret` + hlavička
  `X-Telegram-Bot-Api-Secret-Token`; bez `TELEGRAM_*` env je kanál vypnutý (404).
- Příkazy: `/start <kód>`, `/firmy`, `/hledat`, `/pozornost`, `/zalozit`, `/odpojit`,
  `/pomoc`; zápisy přes inline tlačítka Potvrdit/Zrušit (callback = id konverzace + HMAC).
- Telegram Bot API za rozhraním `TelegramApi` – v testech mock, žádný reálný bot/token.

## Krok 3 – MCP (Streamable HTTP)
- `POST /mcp` (JSON-RPC 2.0: `initialize`, `tools/list`, `tools/call`, `ping`), nástroje
  generované z ActionRegistry (JSON Schema z Zod, `readOnlyHint`/`destructiveHint`).
- **Dočasně osobní přístupový token (PAT)** místo OAuth 2.1: `mcp_access_tokens`
  (hash, vázaný na uživatele + firmu, expirace, odvolání), `POST/GET/DELETE /channels/mcp-tokens`.
  TODO: OAuth 2.1 (node-oidc-provider, PKCE, `resource`/`aud`, RFC 9728/8414 metadata)
  – samostatný krok, PAT pak zůstane jen pro vývojáře / vypne se.

## Krok 4 – web (pokud zbude čas)
- Profil → „Propojené kanály": kód pro Telegram, seznam propojení, MCP tokeny.

## Mimo tento průchod
AI parser (text + fotka → návrh), fotky z kanálů, WhatsApp (F3), `users.locale` + angličtina,
OAuth pro MCP, akce `asset.issue`/`asset.return`, Caddy cesty (`/mcp`, webhook) – při nasazení.

## Stav (2026-10-15)

- [x] Krok 1 – ActionRegistry, akce v1, executor (RBAC, RLS, politiky, moduly, audit).
- [x] Krok 2 – ChannelIdentity, propojovací kódy, Telegram webhook + bot s potvrzováním.
- [x] Krok 3 – MCP (`POST /mcp`, JSON-RPC, bez SSE) s osobními tokeny `tgm_…`.
  TODO: OAuth 2.1 (PKCE, DCR, protected resource metadata) místo osobních tokenů.
- [ ] Krok 4 – web UI „Propojené kanály“ (API endpointy hotové: `/channels/telegram/link-code`,
  `/channels/identities`, `/channels/mcp-tokens`).
- [ ] Nasazení: Caddy route `/mcp` → api, `setWebhook` Telegramu, env `TELEGRAM_*`, úklid
  `channel_processed_updates` (zatím neroste řízeně).

## Kontrola pokrytí MCP (manifest)

- Manifest `apps/api/src/modules/channels/actions/mcp-coverage.ts` obsahuje výslovné rozhodnutí pro **každé oprávnění** (`MCP_PERMISSION_COVERAGE`) a **každý API controller** (`MCP_CONTROLLER_COVERAGE`): `{ actions: [...] }` (klíče z `ActionRegistry`) nebo `{ excluded: "krátký důvod" }`.
- Test `mcp-coverage.spec.ts` (běží v `pnpm test`, tedy v CI) bez bootu aplikace:
  - sesbírá klíče oprávnění z migrací katalogu (`INSERT INTO "permissions"`) a z metadat `@RequirePermission`,
  - naimportuje všechny `*.controller.ts` a podle Nest metadat (`__controller__`) najde controllery a jejich routy,
  - selže, pokud něco v manifestu chybí (vypíše chybějící položky a kam je doplnit), pokud manifest obsahuje zastaralé záznamy, odkazuje na neexistující akci, nebo akce v registru není uvedena u svého oprávnění.
- Granularita controllerů je po třídách; nová routa s novým oprávněním je zachycena kontrolou oprávnění.
