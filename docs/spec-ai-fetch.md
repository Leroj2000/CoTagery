# AI dohledání technických specifikací položky (kontrakt n8n workflow)

Sekce „Technické specifikace" na kartě položky umí přes AI dohledat klíčové parametry
(výrobce, model, výkon, hmotnost, rozměry…) a zobrazit je jako tabulku + zdroj. Na rozdíl
od manuálů (soubory) jde o **strukturovaná data** – spolehlivější, protože Perplexity
parametry skoro vždy najde/shrne, kdežto volně stažitelný PDF manuál je vzácný.

Sdílí **webhook/HMAC/interní síť** s původním manuálovým tokem (`MANUAL_FETCH_WEBHOOK_URL`
/ `_SECRET`, `MANUAL_CALLBACK_BASE_URL`). Rozdíl: payload nese `specId` a `callbackUrl`
míří na **`/api/v1/specs/webhook/callback`**; workflow vrací **specifikace**, ne soubor.

## 1) Odchozí webhook (API → n8n)

Po stisku „Načíst přes AI" API založí `asset_specs` řádek `status='fetching'` a `POST`ne na
`MANUAL_FETCH_WEBHOOK_URL`:
```json
{
  "specId": "uuid",
  "assetId": "uuid",
  "tenantId": "uuid",
  "name": "Rotační laser Hilti PR 30",
  "manufacturer": "Hilti",
  "model": "PR 30",
  "callbackUrl": "http://tagery-api-1:3001/api/v1/specs/webhook/callback"
}
```
Hlavička `x-manual-signature` = HMAC-SHA256(hex) raw těla přes `MANUAL_FETCH_WEBHOOK_SECRET`.

## 2) Workflow v n8n

1. Ověř `x-manual-signature` (HMAC raw těla). Odpověz webhooku hned 200 „accepted".
2. AI (Perplexity) dohledej **technické specifikace** položky dle `manufacturer`+`model`
   (fallback `name`). Nech vrátit **STRIKTNÍ JSON** – pole `{label, value}`, česky,
   jen fakta, žádný prozaický text:
   ```json
   { "specs": [ {"label":"Výkon","value":"650 W"}, {"label":"Hmotnost","value":"1,2 kg"} ],
     "sourceUrl": "https://…" }
   ```
   Prompt ať obsahuje: „Return the item's technical specifications as strict JSON:
   an array `specs` of `{label, value}` pairs (concise, factual, in Czech), plus a
   `sourceUrl`. No prose, no markdown."
3. Zavolej `callbackUrl` (POST) – viz níže.

## 3) Callback (n8n → API)

`POST {callbackUrl}` s hlavičkou `x-manual-signature` (HMAC raw JSON těla přes secret):

Úspěch:
```json
{ "specId": "uuid", "specs": [ {"label":"…","value":"…"} ], "sourceUrl": "https://…" }
```
Neúspěch:
```json
{ "specId": "uuid", "failed": true, "reason": "Specifikace nenalezeny" }
```

## 4) Rychlost a spolehlivost

- **Časový rozpočet + VŽDY callback:** timeout na AI node (~30–45 s); přidej **Error
  Trigger** / „Continue On Fail", aby JAKÁKOLIV chyba skončila `{ failed: true, reason }`.
  Nikdy nekonči bez callbacku. Cíl: běh < ~60 s.

**Co tagery řeší za tebe:** položky bez výrobce i modelu se do workflow vůbec nepošlou
(pre-check → hned „málo detailů"); callback specifikace očistí (max 40 položek, ořízne
délky); zaseklý `fetching` překlopí po 2 min na `failed`; `reason` z callbacku se ukáže v UI.
