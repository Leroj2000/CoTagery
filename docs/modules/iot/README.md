# Modul: IoT / Automation (AS IS)

## 5.10 Automation modul (scény / akce)

**Use-case:** QR/NFC = spouštěč scén. Ovládání světel/žaluzií, nastavení telefonu (Focus mode, BT, Wi-Fi), spuštění playlistu, navigace + SMS ETA.

**Entity:**
```
AutomationScene
  digital_object_id
  tenant_id
  name
  description
  trigger_settings_json

AutomationAction
  scene_id
  order (pořadí v sekvenci)
  action_type: webhook | http_request | open_url | os_shortcut | send_message | start_timer
  action_config_json
```

**Jak funguje:**
- Scan/tap QR nebo NFC → resolver zavolá `handleScan` pro automation modul
- Backend nebo klient (browser/app) provede akce v pořadí podle `order`
- `action_config_json` obsahuje specifický payload pro každý typ akce

**Příklady scén:**
| Scéna | Akce |
|---|---|
| Odchod z domova | open_url (alarm vypnout) + webhook (Smart Home) + send_message (ETA rodině) |
| Příchod do kanceláře | http_request (zapnout světla) + os_shortcut (Work Focus mode) |
| Fitko | start_timer + open_url (playlist Spotify) |
| Parkoviště | os_shortcut (uložit polohu auta) |

## Závislosti na core
- `DigitalObject.module_type` = `automation`
- `ScanEvent.event_type` = `scan` / `tap`
- Klient musí podporovat WebNFC API pro NFC triggery
