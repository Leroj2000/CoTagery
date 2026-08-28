# AI stahování manuálů k položce (kontrakt n8n workflow)

Sekce „Manuály a návody" na kartě položky umí manuál získat třemi způsoby:
upload souboru, vyfocení kamerou, nebo **automatické stažení „přes AI"**. AI
cesta je napojená na existující automatizační infra přes **webhook do n8n**
(stejný vzor jako reset hesla přes `PASSWORD_RESET_WEBHOOK_URL`).

Upload a kamera fungují **vždy** a nezávisle na této konfiguraci. Když AI webhook
není nastaven, tlačítko „Stáhnout přes AI" vrátí čitelný stav
„AI stahování zatím není nakonfigurováno" (ne chybu 500).

## Konfigurace (API `apps/api`)

| Env | Povinné | Význam |
|---|---|---|
| `MANUAL_FETCH_WEBHOOK_URL` | ne | URL n8n webhooku. Když prázdné → AI cesta vypnutá. |
| `MANUAL_FETCH_WEBHOOK_SECRET` | ne | Sdílené tajemství pro HMAC podpis (webhook i callback). |
| `PUBLIC_BASE_URL` | ano (default) | Základ pro `callbackUrl`, který n8n zavolá zpět. |

## 1) Odchozí webhook (API → n8n)

Když uživatel stiskne „Stáhnout přes AI", API:
1. založí řádek `asset_manuals` se `status='fetching'`, `source='ai'`,
   `file_key=null`;
2. `POST` na `MANUAL_FETCH_WEBHOOK_URL` s tělem:

```json
{
  "manualId": "uuid",
  "assetId": "uuid",
  "tenantId": "uuid",
  "name": "Vrtačka Bosch",
  "manufacturer": "Bosch",
  "model": "GSB 13 RE",
  "callbackUrl": "https://<PUBLIC_BASE_URL>/api/v1/manuals/webhook/callback"
}
```

Hlavička (když je `MANUAL_FETCH_WEBHOOK_SECRET` nastaven):

```
x-manual-signature: <HMAC-SHA256(hex) těla přes MANUAL_FETCH_WEBHOOK_SECRET>
```

## 2) Workflow v n8n (běží mimo repo)

1. Přijmi webhook, ověř `x-manual-signature` (HMAC-SHA256 raw těla).
2. AI web-search (agent / HTTP node) → najdi **oficiální PDF manuál** podle
   `manufacturer` + `model` (fallback `name`).
3. Získej veřejnou URL PDF (nebo si ho ulož na dočasné veřejné místo).
4. Zavolej `callbackUrl` (viz níže).

## 3) Callback (n8n → API)

`POST {callbackUrl}` s hlavičkou `x-manual-signature`
(= HMAC-SHA256 raw JSON těla přes `MANUAL_FETCH_WEBHOOK_SECRET`) a tělem:

Úspěch – server si PDF stáhne z `fileUrl`:

```json
{ "manualId": "uuid", "fileUrl": "https://.../manual.pdf", "sourceUrl": "https://vyrobce/…" }
```

Neúspěch (nenalezeno):

```json
{ "manualId": "uuid", "failed": true }
```

Chování API:
- ověří podpis (když je secret nastaven; jinak se podpis nevyžaduje),
- dohledá tenanta podle `manualId` přes `asset_manual_lookup` (SECURITY DEFINER,
  bez JWT – jako billing webhook),
- v tenant kontextu stáhne soubor z `fileUrl`, uloží přes StoragePort a přepne
  řádek na `status='ready'`; při `failed:true` na `status='failed'`.
- Přijímá jen PDF a obrázky, limit 25 MB.

> Poznámka: MVP přijímá `fileUrl` (server si stáhne). Přímý upload binárky do
> callbacku lze doplnit později – seam je v `ManualCallbackService.handle`.

## 4) Doporučený postup workflow pro RYCHLOST a SPOLEHLIVOST

Cíl: buď rychle najít stažitelný manuál, nebo do ~1–2 min jednoznačně říct „nenalezen".
Nikdy neskončit bez callbacku (jinak řádek visí do timeoutu).

**a) Robustní dotaz.** Sestav z `manufacturer` + `model` (fallback `name`, když chybí).
Nech AI vrátit **STRIKTNÍ JSON se 3–5 kandidáty**, jen **přímé PDF** odkazy z oficiálního
webu výrobce nebo renomovaného archivu manuálů (žádné „landing" stránky):
```json
{ "candidates": [ { "url": "https://…/manual.pdf", "label": "…" } ] }
```
Prompt ať obsahuje: „Return only direct downloadable PDF URLs (filetype pdf), from the
manufacturer's official site or a reputable manual archive. No landing pages. Strict JSON."

**b) Ověř kandidáty (HTTP node, HEAD/GET).** Pro každý: HTTP **200** a `content-type`
obsahuje **`application/pdf`** (příp. velikost < 25 MB). Vezmi **první platný** → callback
`{ manualId, fileUrl, sourceUrl }`. Když žádný neprojde → callback `{ manualId, failed: true,
reason: "Manuál k dispozici nenalezen" }`.

**c) Časový rozpočet + VŽDY callback.** Timeout na AI node (~30–45 s) i na validaci
(~10 s/kandidát). Přidej **Error Trigger** (nebo „Continue On Fail" + IF), aby **jakákoliv**
chyba skončila `{ failed: true, reason }`. Nikdy nekonči bez callbacku. Cíl: celý běh < ~90 s.

**Co dělá tagery navíc (nemusíš řešit ve workflow):** položky bez výrobce i modelu se do
workflow vůbec nepošlou (pre-check → hned „málo detailů"); stažený `fileUrl` server znovu
ověří podle magic bytes `%PDF` (odmítne HTML vydávané za PDF) se stahovacím timeoutem;
zaseklý `fetching` překlopí po 2 min na `failed`. Volitelný `reason` v callbacku se ukáže v UI.
