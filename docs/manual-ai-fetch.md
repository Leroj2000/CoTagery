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
