# Propojené kanály (EPIC-22) – zprovoznění na serveru

Kód je nasazený a migrace `ChannelFeatures1929400000000`, `ChannelIdentities1929500000000`
a `McpAccessTokens1929600000000` jsou spuštěné. Pro provoz zbývá zpřístupnit dvě cesty
v Caddy a nastavit Telegram bota. Uživatelé pak kanály spravují v aplikaci na stránce
**Nastavení a správa → Propojené kanály** (`/admin/settings/channels`).

## 1. Caddy – cesty `/mcp` a Telegram webhook

Caddy běží jako kontejner `caddy` (projekt `/root/infra/caddy`). Konfigurace je
`/root/infra/caddy/Caddyfile`, do kontejneru je připojená jako `/etc/caddy/Caddyfile`.
Doména `app.tagery.tech` dnes posílá `/r/*` přímo na API (`tagery-api-1:3001`, sdílená
síť `n8n_default`) a vše ostatní na Next.js web (`172.18.0.1:3000`). Cesty `/api/v1/*`
z venku nejsou dostupné – web volá API interně. Proto je potřeba přidat obě nové cesty
explicitně.

Do bloku `app.tagery.tech { … }` vlož **před** závěrečný `handle { … }` (Next.js web):

```caddy
	# EPIC-22: MCP server (Streamable HTTP) -> tagery API (mimo prefix /api/v1)
	handle /mcp {
		reverse_proxy tagery-api-1:3001 {
			import fwd
		}
	}
	# EPIC-22: Telegram webhook -> tagery API (jen tato cesta, ne celé /api)
	handle /api/v1/channels/telegram/webhook/* {
		reverse_proxy tagery-api-1:3001 {
			import fwd
		}
	}
```

Soubor je připojený jako jednotlivý soubor (bind mount). Uprav ho editorem, který
zapisuje do stejného souboru (např. `nano`, `vim`), ne nahrazením souboru – jinak by
kontejner dál viděl starou verzi.

Ověření a načtení bez restartu:

```sh
cp /root/infra/caddy/Caddyfile /root/infra/caddy/Caddyfile.bak-$(date +%Y%m%d-%H%M%S)
docker exec caddy caddy fmt --diff /etc/caddy/Caddyfile   # jen ukáže formátování
docker exec caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker exec caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
```

Kontrola zvenku:

```sh
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://app.tagery.tech/mcp
# očekávaně 401 (bez tokenu)
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://app.tagery.tech/api/v1/channels/telegram/webhook/x
# očekávaně 404 (špatný secret / Telegram ještě nenastavený)
```

## 2. Telegram bot

Pozor: na serveru běží jiný bot (`/opt/tagery-telegram`, služba `tagery-telegram.service`).
Pro Tagery kanály založ **nového** bota – jeden token nemůže současně používat webhook
a jiný proces.

1. V Telegramu napiš [@BotFather](https://t.me/BotFather) příkaz `/newbot`, zadej název
   (např. „Tagery“) a uživatelské jméno končící na `bot` (např. `tagery_app_bot`).
   BotFather vrátí token bota.
2. Volitelně u BotFathera `/setcommands` pro nového bota:
   ```
   hledat - Najít položku
   pozornost - Co vyžaduje pozornost
   zalozit - Založit položku
   firmy - Vybrat firmu
   odpojit - Odpojit chat od účtu
   pomoc - Nápověda
   ```
   a `/setjoingroups` → `Disable` (bot funguje jen v soukromém chatu).
3. Vygeneruj tajný klíč webhooku (64 znaků, povoleno `A-Za-z0-9_-`):
   ```sh
   openssl rand -hex 32
   ```
4. Do `/root/projects/tagery/.env` doplň (hodnoty nikam nekopíruj ani nevypisuj):
   - `TELEGRAM_BOT_TOKEN` – token od BotFathera,
   - `TELEGRAM_WEBHOOK_SECRET` – vygenerovaný klíč,
   - `TELEGRAM_BOT_USERNAME` – uživatelské jméno bota **bez** `@`.
5. Znovu vytvoř jen kontejner API, aby načetl nové proměnné:
   ```sh
   cd /root/projects/tagery
   docker compose -p tagery --env-file /root/projects/tagery/.env -f docker-compose.yml \
     up -d --no-deps --no-build api
   curl -s http://127.0.0.1:3001/api/v1/health
   ```
6. Zaregistruj webhook u Telegramu (hodnoty se čtou z `.env`, nevypisují se; vyžaduje
   hotový krok 1 – cestu v Caddy):
   ```sh
   cd /root/projects/tagery
   TG_TOKEN=$(grep -E '^TELEGRAM_BOT_TOKEN=' .env | cut -d= -f2-)
   TG_SECRET=$(grep -E '^TELEGRAM_WEBHOOK_SECRET=' .env | cut -d= -f2-)
   curl -sS "https://api.telegram.org/bot${TG_TOKEN}/setWebhook" \
     --data-urlencode "url=https://app.tagery.tech/api/v1/channels/telegram/webhook/${TG_SECRET}" \
     --data-urlencode "secret_token=${TG_SECRET}" \
     --data-urlencode 'allowed_updates=["message","callback_query"]' \
     --data-urlencode 'drop_pending_updates=true'
   # očekávaně {"ok":true,"result":true,"description":"Webhook was set"}
   curl -sS "https://api.telegram.org/bot${TG_TOKEN}/getWebhookInfo"
   # pending_update_count 0, žádné last_error_message
   unset TG_TOKEN TG_SECRET
   ```
7. Test: v aplikaci otevři **Propojené kanály → Propojit Telegram**, klepni na odkaz do
   Telegramu a „Start“. Bot odpoví potvrzením propojení; zkus poslat název položky.

Vypnutí: `curl -sS "https://api.telegram.org/bot${TG_TOKEN}/deleteWebhook"` a smazat
`TELEGRAM_WEBHOOK_SECRET` z `.env` + znovu vytvořit API (webhook pak vrací 404).

## 3. MCP (AI asistenti)

- Adresa: `https://app.tagery.tech/mcp` (Streamable HTTP, jen JSON odpovědi, bez SSE).
- Autentizace: `Authorization: Bearer tgm_…` – osobní token z **Propojené kanály**;
  platí pro jednu firmu a s oprávněními uživatele. OAuth 2.1 zatím není (TODO).
- Claude Code:
  `claude mcp add --transport http tagery https://app.tagery.tech/mcp --header "Authorization: Bearer tgm_…"`

## Funkce předplatného

Kanály řídí funkce `channel_telegram` a `channel_mcp` (tarify trial, pro, business).
Když je firma nemá, stránka je skryje a API vrací `CHANNEL_DISABLED`.
