# Poloha při čtení identifikátorů

Web za reverzní proxy musí mít `PUBLIC_WEB_URL` nastavené na veřejný origin (např. `https://app.tagery.tech`); používá se ke kontrole původu požadavku skeneru. Docker Compose tuto hodnotu předává webu i API.

Geolokace vyžaduje HTTPS (případně localhost) a povolení uživatele; viz [dokumentace prohlížečové geolokace](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition).

Interní `/admin/scan` při každém skenu automaticky jednorázově požádá o polohu. Prohlížeč může oprávnění zapamatovat a příště se neptat. Automatické získávání lze vypnout v rozbalovacím nastavení pro aktuální otevření skeneru. Odmítnutí, timeout nebo nedostupnost otevře nabídku ručního doplnění: výběr evidovaného místa, výběr bodu na mapě nebo „Pokračovat bez polohy“. Do dokončení této volby se sken nezapisuje; zrušení nezanechá pozorování. Výsledek výběru je navázaný na původní kód a technologii, nikoli později upravený vstup.

Ruční poloha je v interní historii označená „Zadáno ručně“. Souřadnice vidí jen oprávnění uživatelé; veřejný resolver je nezobrazuje ani nezískává. Uložení pozorování musí u nového POST skenu uspět, jinak se vrátí chyba, nikoli nepravdivé potvrzení uložení.

Čtečky používají autentizované `POST /api/v1/scan` (oprávnění `asset.scan.use`):

```json
{
  "code": "evidovany-kod-nebo-nfc-uid",
  "technology": "rfid",
  "readerId": "sklad-ctec-ka-01",
  "position": {
    "latitude": 50.08,
    "longitude": 14.43,
    "accuracyMeters": 15,
    "capturedAt": "2026-09-06T12:00:00Z",
    "source": "reader"
  }
}
```

`position`, `readerId` a `technology` jsou volitelné. Technologie: `qr`, `barcode`, `nfc`, `rfid`, `manual`, `unknown`. Zdroj souřadnic: `device`, `reader` nebo `manual`. Čas pozorování přidává server, čas polohy hlásí zařízení. Žádný klientský údaj není důkazem přítomnosti ani ověřenou identitou čtečky.

Pro ruční bod odešli `position.source: "manual"` se souřadnicemi a `capturedAt`; `accuracyMeters` je v tomto případě volitelné a web je neposílá, protože nejde o GPS měření. Pro evidované místo odešli `manualLocationId: "UUID"` bez `position`. Server ověřuje dostupnost místa v aktuálním tenantu a odmítá kombinaci místa a souřadnic. Místo se uloží do `asset_observations.location_id`, ruční původ do `capture_context.manualLocationId`. Nejde o změnu evidovaného umístění věci.

Mapa používá Leaflet a dlaždice OpenStreetMap s viditelnou atribucí. Načítá se až po kliknutí „Otevřít mapu“ a upozornění na přenos IP/oblasti poskytovateli. Bez načtené mapy lze stále vybrat místo nebo pokračovat bez polohy. Pro větší provoz je nutné zvolit odpovídajícího poskytovatele v souladu s [pravidly OSM dlaždic](https://operations.osmfoundation.org/policies/tiles/).

QR/čárový kód, resolver URL a existující externí aliasy používají stejné vyhledávání; NFC lze číst podle spárovaného `nfcUid`. RFID EPC se nejprve adoptuje jako externí kód (`custom`). USB čtečka emulující klávesnici může kód vložit do interního skeneru. Přímé ovladače NFC/RFID hardwaru ani trvalé sledování tato verze neobsahuje.

Metadata jsou uložená v `asset_observations.capture_context`, pod stávajícím tenantovým RLS. Nemění držitele ani pohybový ledger. Kontrakt lze použít pro budoucí docházku; docházková pravidla ani ověření stanovišť zatím nejsou implementované. Inventurní a veřejné skeny zatím zachovávají původní chování bez souřadnic.
