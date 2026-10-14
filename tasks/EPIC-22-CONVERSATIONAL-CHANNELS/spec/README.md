# EPIC-22-CONVERSATIONAL-CHANNELS – Ovládání Tagery přes WhatsApp, Telegram a AI asistenty (MCP)

## Stav: ⬜ ZADÁNO (2026-10-14, rozhodnutí níže) · ke zpracování v budoucnu

## Cíl
Uživatel může s Tagery pracovat mimo webovou aplikaci:
- **WhatsApp / Telegram:** vyfotí věc, napíše „Vrtačka Makita, sklad A" → bot navrhne
  položku, uživatel potvrdí tlačítkem a položka je založená (vč. fotky, štítku).
  Později dotazy („kde je vrtačka?"), vrácení, nahlášení závady.
- **AI asistenti přes MCP (ChatGPT, Claude…):** uživatel připojí Tagery jako konektor a
  asistent za něj hledá, zakládá, vydává a vrací položky.

Klíčový princip: **jedna společná vrstva akcí** (doménové „nástroje"), nad kterou jsou
kanály jen tenké adaptéry. Každá akce běží **jako konkrétní uživatel v konkrétní firmě**
– stejná oprávnění (RBAC), RLS, limity předplatného a audit jako ve webu.

## Architektura

```
 WhatsApp (Cloud API) ─┐                        ┌─ AI parser (text+foto → návrh položky)
 Telegram (Bot API) ───┼─► ChannelAdapter ──► ConversationEngine ──► ActionRegistry ──► stávající služby
 MCP (ChatGPT/Claude) ─┘   (webhook / MCP)     (stav, potvrzení)      (nástroje)          (AssetService…)
                                   │
                          ChannelIdentity (kdo píše → user + firma)
```

### 1. ActionRegistry – společné nástroje (jádro)
Modul `apps/api/src/modules/channels/actions/` (NestJS). Každá akce:
- `key` (např. `asset.search`), popis pro AI/MCP, **Zod schéma** vstupu a výstupu,
- `permission` (stávající klíč, např. `asset.item.create`) a případně `module`/funkce předplatného,
- příznaky `readOnly` / `destructive` / `requiresConfirmation`,
- `execute(ctx, input)` – volá stávající služby v `runInTenant` kontextu uživatele.

Kontext `ActionContext`: `userId`, `tenantId`, `membershipId`, `channel`
(`whatsapp|telegram|mcp`), `locale`. Vynucení: `AuthzService.can` (oprávnění + modul),
`EntitlementsService` (402 limity), audit se `context.channel`.

**Akce v1:**

| Klíč | Typ | Popis |
|---|---|---|
| `asset.search` | čtení | najít položky (text, inventární číslo, SPZ, místo) |
| `asset.get` | čtení | detail: kde je, kdo ji má, stav, záruka, servis |
| `asset.create` | zápis, potvrzení | založit položku (název, kategorie, výrobce, model, výr. číslo, místo, fotka) |
| `asset.issue` | zápis, potvrzení | vydat položku osobě |
| `asset.return` | zápis, potvrzení | přijmout vrácení (vč. povinné fotky, pokud ji firma vyžaduje) |
| `asset.move` | zápis, potvrzení | přesunout na místo |
| `issue.report` | zápis | nahlásit závadu (text + fotka) |
| `attention.list` | čtení | co vyžaduje pozornost (po termínu, servis, končící záruky) |
| `location.search` | čtení | najít místo (pro výběr při zakládání/přesunu) |
| `org.list` / `org.select` | kontext | firmy uživatele / přepnutí firmy |

**v2:** inventura (spuštění, stav), stav tachometru vozidla, rezervace, tisk štítku (odkaz).

### 2. ChannelIdentity – kdo píše
Tabulka `channel_identities` (bez RLS na lookup přes SECURITY DEFINER, zápis v kontextu
firmy): `id`, `user_id`, `channel` (`whatsapp|telegram`), `external_id` (telefon E.164 /
Telegram chat id), `verified_at`, `default_tenant_id`, `created_at`, `revoked_at`.
Unikát `(channel, external_id)`.

**Propojení účtu:**
1. Web → Profil → „Propojit WhatsApp/Telegram" → vygeneruje jednorázový kód (6 číslic, platnost 10 min,
   v DB jen hash).
2. Uživatel pošle kód botovi (Telegram: deep link `t.me/<bot>?start=<kód>`; WhatsApp: zpráva
   s kódem nebo wa.me odkaz s předvyplněným textem).
3. Bot spáruje `external_id` s uživatelem. Neznámé číslo dostane jen návod na propojení –
   **žádná data**.
4. Profil zobrazuje propojené kanály s tlačítkem **Odpojit**. Pozastavené členství / smazaný
   účet = kanál přestane fungovat (kontrola při každé zprávě).

**Firma:** výchozí = `default_tenant_id`; u více firem bot nabídne výběr („Pracuješ ve firmě
APRIS – změnit?"). Volba se pamatuje.

### 3. ConversationEngine – stav konverzace
Tabulka `channel_conversations`: `identity_id`, `state` (jsonb – rozpracovaná akce,
návrh, čekání na potvrzení), `updated_at`, `expires_at` (např. 30 min).
- Rozpracovaný návrh položky (draft) → tlačítka **Uložit / Upravit / Zrušit**.
- Úpravy volným textem („místo Sklad B", „kategorie Nářadí") → aktualizace návrhu.
- Zápisové akce se **vždy potvrzují** (tlačítko), čtení ne.
- Idempotence: ID zprávy kanálu (`message_id`) se ukládá → opakované doručení webhooku
  nezaloží položku dvakrát.

### 4. AI parser – text + fotka → návrh
- Vstup: text zprávy, případně fotka (a více fotek v jednom albu).
- Výstup (Zod): `{ name, category?, manufacturer?, model?, serialNumber?, locationHint?, intent }`
  – `intent` ∈ `create | search | return | issue | report | other`.
- Napojení přes stávající n8n/LLM infrastrukturu (jako AI dohledání návodů,
  `ManualFetchService`); kategorie a místa se mapují na
  existující číselníky firmy (fuzzy shoda, jinak dotaz „Založit novou kategorii X?").
- Spotřeba se počítá do limitu **`ai_per_month`** předplatného (EPIC-20); bez AI funkce
  bot umí jen strukturované příkazy a tlačítka.

### 5. Adaptéry kanálů

**Telegram (první, pilot):**
- Bot API, webhook `POST /api/v1/channels/telegram/webhook/<secret>` + ověření
  `X-Telegram-Bot-Api-Secret-Token`.
- Inline tlačítka (callback_query), stažení fotky přes `getFile`.
- Zdarma, bez ověřování firmy → rychlý pilot.

**WhatsApp (Cloud API):**
- Webhook `GET` (verify token) + `POST /api/v1/channels/whatsapp/webhook`, ověření podpisu
  `X-Hub-Signature-256` (HMAC app secret).
- Stažení médií přes Graph API (media id → URL → download s tokenem), interaktivní tlačítka
  (max 3) / list zprávy.
- **Odpovědi jen v 24h okně** po zprávě uživatele (servisní zprávy); notifikace z iniciativy
  firmy (upomínky výpůjček…) jen přes schválené **šablony** – mimo rozsah v1.
- **Politika Meta (od 15. 1. 2026):** zakázaní jsou univerzální AI chatboti; úzce zaměřený
  pracovní bot (evidence majetku) je povolený → bot **odmítá** obecné dotazy mimo Tagery.
- **Ceny (stav 10/2026):** příchozí zdarma; servisní odpovědi v 24h okně zdarma do
  1 000/měsíc na číslo, dál za sazbu „utility"; šablony vždy placené. → Sledovat počty
  (`platform_usage_meters`, metrika `whatsapp_messages`), případně zahrnout do předplatného.
- Předpoklady: Meta Business účet, **ověření firmy** (dny), vyhrazené telefonní číslo, app
  v Meta for Developers, systémový uživatel + trvalý token (uložit jako secret).

**MCP (ChatGPT, Claude…):**
- Knihovna **[@rekog/mcp-nest](https://github.com/rekog-labs/mcp-nest)** (MIT) – MCP server v NestJS,
  Streamable HTTP na `https://app.tagery.tech/mcp`. Nástroje se generují z ActionRegistry
  (název, popis, Zod schéma, `readOnlyHint` / `destructiveHint` anotace).
- **OAuth 2.1 přihlašovací server:** **[node-oidc-provider](https://github.com/panva/node-oidc-provider)**
  s **naší** přihlašovací a souhlasovou stránkou („ChatGPT chce přístup k Tagery – firma X,
  role Y"); PKCE S256, parametr `resource` → `aud` v tokenu, krátké access tokeny + refresh,
  odvolání. Registrace klientů: **předdefinovaný klient** pro ChatGPT (redirect
  `https://chatgpt.com/connector_platform_oauth_redirect`) a DCR; **CIMD** (Client ID
  Metadata Documents, MCP spec 2026-07-28 ho preferuje) doplnit, jakmile ho zvolená knihovna
  podporuje – ověřit při startu.
- Metadata: `/.well-known/oauth-protected-resource` (RFC 9728) na MCP serveru,
  `/.well-known/oauth-authorization-server` (RFC 8414); ověřování tokenů helpery oficiálního
  MCP TypeScript SDK (`requireBearerAuth`).
- Profil → **Připojené aplikace** (seznam + Odpojit = odvolání tokenů).
- Pozn.: přihlašovací server mcp-nest-auth je beta a federuje jen na GitHub/Google → nepoužít.

### 6. Bezpečnost
- Žádná data bez ověřené identity; neznámý odesílatel = jen návod k propojení.
- Ověření podpisů webhooků (WhatsApp HMAC, Telegram secret token), rate limit na identitu.
- Fotky z kanálů projdou stejnou validací jako upload (MIME, velikost) a **limitem úložiště**
  (`TrackingStorage`).
- Audit: každá akce `channel`, `external_id` (maskovaný), `action`, výsledek.
- Tokeny/secrets jen v env (`TELEGRAM_BOT_TOKEN`, `WHATSAPP_TOKEN`, `WHATSAPP_APP_SECRET`,
  `WHATSAPP_VERIFY_TOKEN`, OIDC klíče).
- Caddy: nové veřejné cesty `/api/v1/channels/*`, `/mcp`, `/.well-known/*` – **před změnou
  ověřit, že se nedotkne Caddy pro rentigon**.

### 7. Předplatné a zapínání (EPIC-20)
- Tři samostatné funkce v katalogu `PLAN_FEATURES`, každá zvlášť řízená:
  - **`channel_telegram`** – Telegram bot, **součást předplatného** (výchozí od Pro + Zkušební),
  - **`channel_mcp`** – AI asistenti (ChatGPT, Claude…), **součást předplatného** (od Pro + Zkušební),
  - **`channel_whatsapp`** – WhatsApp, **placená extra služba mimo úrovně předplatného**:
    v žádné úrovni není, zapíná ji superadmin firmě výjimkou (`entitlement_overrides`) po
    objednání. Účtuje se měsíční poplatek + zprávy nad zahrnutý počet (měření
    `platform_usage_meters`, metrika `whatsapp_messages`; položka na faktuře předplatného,
    viz F3). Ceník doplnit při startu F3 podle aktuálních sazeb Meta.
- **Kdo smí používat:** všechny role (každá jen v mezích svých oprávnění – kanál nic nepřidává).
- **Kdo smí zapnout/vypnout pro firmu:** **jen owner** (Nastavení → Funkce), stejně jako
  ostatní funkce – stávající oprávnění `core.module.configure`, žádné nové oprávnění se
  nezavádí. Platí zámek platformy: co předplatné / superadmin nepovolil, owner nepřepne
  (zejména `channel_whatsapp` bez objednávky).
- Vypnutí kanálu firmou = zprávy z kanálu dostanou „Ve firmě X je WhatsApp/Telegram vypnutý"
  a MCP vrací 403; propojení identit zůstávají (po zapnutí znovu fungují).
- AI vytažení údajů → limit `ai_per_month`; fotky → `storage_mb`.

### 8. Izolace firem při sdíleném čísle / botovi (neprůstřelnost)
Jedno sdílené číslo WhatsApp a jeden Telegram bot pro všechny firmy. Data firmy se nikdy
nesmí dostat k uživateli jiné firmy – vynucuje se **ve více nezávislých vrstvách**:
1. **Identita ≠ firma:** `external_id` (telefon / chat id) ukazuje jen na **uživatele**
   (`channel_identities.user_id`), nikdy přímo na firmu. Propojit lze jen kódem vygenerovaným
   v přihlášeném webu (hash v DB, 10 min, jednorázový, rate limit pokusů) – cizí telefon se
   k účtu nepřipojí bez přístupu k účtu.
2. **Firma jen z aktivních členství:** aktivní firma konverzace se vybírá výhradně ze seznamu
   `org_memberships` uživatele se `status = 'active'`; volba se **ověřuje při každé zprávě**
   (ne jen při přepnutí) – pozastavené/zrušené členství = okamžitě konec přístupu.
3. **Každá akce v `runInTenant(tenantId)` + RLS:** stejná cesta jako HTTP požadavek z webu
   (`TenantTransactionInterceptor` logika – aktivní membership, scope, policy), takže SQL
   dotazy fyzicky nevidí řádky jiné firmy (FORCE RLS). Žádný „systémový" kontext pro kanály.
4. **Oprávnění per akce:** `AuthzService.can(user, permission)` + stav funkce kanálu ve firmě.
5. **ID z konverzace se neberou naslepo:** položky/místa/osoby, na které se zpráva odkazuje
   (tlačítka, návrhy), se v každém kroku znovu načítají pod RLS aktivní firmy; callback data
   tlačítek nesou jen krátké ID konverzace (podepsané HMAC), ne ID entit.
6. **Stav konverzace vázaný na (identita, firma):** při přepnutí firmy se rozpracované
   návrhy zahodí; draft z firmy A nelze potvrdit ve firmě B.
7. **Média:** fotka stažená z kanálu se ukládá pod klíč `…/<tenantId>/…` aktivní firmy a
   prochází limitem úložiště; odkazy v odpovědích jsou na web (vyžaduje přihlášení), ne veřejné.
8. **MCP tokeny:** access token nese `sub` (uživatel) a **vybranou firmu** + `aud` = MCP
   resource; firma se při každém volání ověřuje proti aktivním členstvím (bod 2).
9. **Testy izolace (DoD, povinné):** uživatel ve firmách A i B; identita propojená; přepínání;
   pokusy podvrhnout ID entity z firmy B, callback data, starý draft, token s firmou, kde
   už není členem; pozastavení členství uprostřed konverzace → vše musí skončit odmítnutím
   bez úniku dat. Plus kontrola, že odpovědi bota neobsahují data jiné firmy (snapshot testy).

### 9. Jazyk (čeština + angličtina) – jeden bot
Nejsou potřeba dva boti ani dvě čísla. Jeden bot odpovídá v jazyce uživatele:
- jazyk = preference v profilu uživatele (nové pole `users.locale`: `cs` | `en`), výchozí
  z Telegram `language_code` / prvního textu zprávy; přepnutí příkazem („English" / „/lang en").
- texty bota v katalogu překladů (`cs`, `en`); AI parser rozumí oběma jazykům, kategorie a
  místa se mapují na číselníky firmy bez ohledu na jazyk.
- MCP: popisy nástrojů anglicky (pro modely), hlášky pro uživatele podle `locale`.
- Navazuje na plánované i18n webu (stejné klíče, kde to dává smysl).

## Fázování
- **F1 – Společná vrstva + Telegram pilot:** ActionRegistry (akce v1), ChannelIdentity +
  propojení v profilu, ConversationEngine, AI parser, Telegram adaptér, funkce `channel_*`,
  čeština/angličtina, izolační testy §8. Odhad ~4–5 dní.
- **F2 – MCP:** mcp-nest server z ActionRegistry, OAuth (node-oidc-provider) s naší
  přihlašovací/souhlasovou stránkou, Připojené aplikace; ověření proti reálnému ChatGPT a
  Claude. Odhad ~3–4 dny (nejdřív prototyp: 1 nástroj + celé přihlášení).
- **F3 – WhatsApp (extra služba):** Cloud API adaptér (po ověření firmy u Meta), měření zpráv,
  ceník a položka na faktuře, zapnutí superadminem. Odhad ~2–3 dny + čekání na Meta.
- **F4 – rozšíření:** inventura, tachometr, rezervace, notifikace přes šablony WhatsApp.

## Rozhodnutí (2026-10-14)
1. **Jedno sdílené číslo / bot** pro všechny firmy – podmínkou je neprůstřelná izolace firem
   (viz §8, povinné testy izolace v DoD).
2. **WhatsApp = placená extra služba** mimo úrovně předplatného (zapíná superadmin, účtuje se
   zvlášť); **Telegram a MCP jsou součástí předplatného** (§7).
3. **Čeština a angličtina jedním botem** podle jazyka uživatele (§9).
4. **Používat smí všechny role** (v mezích svých oprávnění); **zapnout/vypnout kanály pro
   firmu smí jen owner** (stávající `core.module.configure`, §7) – upřesněno 2026-10-14.

## Závislosti
EPIC-18 (authz, membershipy), EPIC-20 (předplatné, limity, `ai`/`channels` funkce),
`TrackingStorage` (úložiště), AI infrastruktura (n8n, `ManualFetchService`), audit.

## Definition of Done
Viz `tasks/ROADMAP.md` §DoD. Navíc: akce přes kanál nikdy neobejde oprávnění, RLS ani limity;
**sada izolačních testů z §8 prochází** (sdílené číslo/bot, uživatel ve více firmách,
podvržená ID, staré drafty, pozastavené členství, MCP token s neplatnou firmou);
idempotentní webhooky; zápisové akce vždy s potvrzením; odpojení kanálu/aplikace okamžitě
zneplatní přístup.

## Zdroje (rešerše 2026-10-14)
- [rekog-labs/mcp-nest](https://github.com/rekog-labs/mcp-nest) ·
  [panva/node-oidc-provider](https://github.com/panva/node-oidc-provider) ·
  [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [OpenAI – autentizace MCP pro ChatGPT](https://developers.openai.com/plugins/build/auth) ·
  [MCP 2026-07-28 – registrace klientů (CIMD)](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/client-registration)
- [WhatsApp API ceny 2026 (EngageLab)](https://www.engagelab.com/blog/whatsapp-business-api-pricing) ·
  [WhatsApp chatbot policy 2026 (respond.io)](https://respond.io/blog/whatsapp-chatbot-policy-2026)
