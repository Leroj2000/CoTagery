# EPIC-04-DIGITAL-OBJECT – Specifikace

## Cíl
Centrální entity platformy: `DigitalObject` (co to je + jaký modul) a `DataCarrier` (fyzický QR/NFC/hybrid nosič), včetně generování QR a párování NFC.

## Scope

### In scope
- Entita `DigitalObject` (module_type, slug, status, primary_url, metadata_json, platnost)
- Entita `DataCarrier` (carrier_type, `public_code`, resolver_url, qr/nfc payload, status, verze)
- Generování `public_code` (ADR-0003 – base62, nesekvenční, unikátní)
- Generování QR obrázku (SVG/PNG) přes `GET /carriers/{id}/qr`
- NFC párování (`nfcUid`, NDEF payload)
- CRUD API dle `docs/reference/api-contracts.md`
- Hook rozhraní `handleScan()` pro moduly (kontrakt, ne implementace modulů)

### Out of scope
- Resolver hot path a ScanEvent pipeline (EPIC-05)
- Konkrétní moduly (Fáze 2)
- Výrobní export (EPIC-02-FABRICATION – navazuje nad DataCarrier)

## Acceptance kritéria
- [ ] Lze vytvořit objekt, přidat mu 1..N nosičů (QR/NFC/hybrid)
- [ ] `public_code` je unikátní, nesekvenční, ≥10 znaků
- [ ] QR export vrací validní skenovatelný kód (SVG i PNG)
- [ ] Časová platnost (`valid_from`/`valid_to`) a `status` respektovány
- [ ] Vše tenant-scoped (izolační test)
- [ ] Definováno rozhraní `handleScan(object, carrier, ctx)` pro moduly

## Závislosti
- EPIC-03-CORE-DOMAIN

## Podúkoly (návrh)
- [ ] TASK-01-DIGITAL-OBJECT – entita + CRUD
- [ ] TASK-02-DATA-CARRIER – entita + public_code generátor
- [ ] TASK-03-QR-GEN – generování QR (SVG/PNG)
- [ ] TASK-04-NFC-PAIR – NFC párování + handleScan kontrakt
