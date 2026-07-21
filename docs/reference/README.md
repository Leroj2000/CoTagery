# Reference – Jádro platformy (AS IS)

## QR/NFC správa

### Trendy 2026 (z průzkumu trhu)
- **Dynamické QR** nahrazují statické – umožňují měnit cíl bez přetisku, sledovat skeny
- **NFC** roste pro prémiové scénáře: ověření pravosti, přístupové karty, "smart" obaly
- **Hybridní štítky** (QR + NFC na jednom nosiči) – uživatel si vybírá dle zařízení
- **GS1 Digital Link** – QR kódy s produktovými daty postupně nahrazují čárové kódy v retailu
- **Bezpečnost** – "quishing" útoky (phishing přes QR) vyžadují ochranu na resolveru

### Doporučení pro Tagery
| Use-case | Nosič |
|---|---|
| Hromadné označení | QR |
| Marketing / kampaně | Dynamické QR |
| Ověření pravosti | NFC nebo QR + NFC |
| Produktové obaly | QR s produktovými daty (GS1) |
| Přístupové karty / eventy | NFC nebo hybrid |
| Pokladny / retail data | GS1 2D kódy / QR |

## Generování a správa kódů
- QR: generování PNG/SVG s možností brandingu, download pro tisk
- NFC: párování přes `nfc_uid`, zápis NDEF URI payload
- Public code: krátký alfanumerický identifikátor (`abc123`) v URL `/r/{public_code}`

## API kontrakty – Core endpointy

### Resolver (veřejný)
```
GET /r/{public_code}
→ HTML nebo JSON podle Accept headeru
```

### DigitalObjects
```
GET    /api/v1/objects          – listing (filtr: module_type, status, location)
POST   /api/v1/objects          – vytvoření
GET    /api/v1/objects/:id      – detail + carriers + scan events
PUT    /api/v1/objects/:id      – úprava
DELETE /api/v1/objects/:id      – archivace
```

### DataCarriers
```
GET    /api/v1/objects/:id/carriers     – seznam nosičů
POST   /api/v1/objects/:id/carriers     – přidat nosič
GET    /api/v1/carriers/:id/qr          – vygenerovat QR (PNG/SVG)
PUT    /api/v1/carriers/:id             – aktualizace (status, payload)
```

### ScanEvents (analytika)
```
GET /api/v1/objects/:id/scans   – log scanů (filtr: datum, typ, carrier)
GET /api/v1/analytics/overview  – dashboard statistiky
```

## Autentizace & autorizace
- JWT Bearer token ve všech requestech (kromě resolveru)
- Token payload: `{ userId, tenantId, tenantRole, exp }`
- Refresh token flow – plánováno v EPIC-01-AUTH
- OAuth2/SSO – plánováno v EPIC-01-AUTH

## Konkurenční analýza (top QR platformy)
Tagery se odlišuje od ME-QR, Uniqode, Flowcode, Bitly tím, že:
- **Multi-modul** – jeden kód může sloužit pro ticketing, rental, gallery, docházku atd.
- **Multi-tenant** – B2B platforma, ne jen jednotlivci
- **API-first** – plná integrace do externích systémů
- **On-premise friendly** – vlastní infrastruktura nebo cloud
