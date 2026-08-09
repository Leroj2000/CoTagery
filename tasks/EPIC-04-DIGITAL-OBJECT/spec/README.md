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

## Stav: 🟡 jádro hotové a ověřené (2026-08-08) + předgenerovaný pool (2026-08-09)

## Rozšíření: nepřiřazené nosiče (pre-printed pool + claim)
- `POST /carriers/batch { count, carrierType? }` – admin předgeneruje N nepřiřazených kódů (k tisku)
- `GET /carriers/unassigned` – pool nepřiřazených
- `POST /carriers/claim { publicCode, objectId }` – přiřazení kódu k objektu (jen v rámci tenanta, RLS)
- Resolver: sken nepřiřazeného kódu → `{status:'unassigned'}` (výzva k aktivaci); po claim se resolve na objekt
- `data_carriers.digital_object_id` je nullable; `resolve_carrier` → LEFT JOIN (migrace UnassignedCarriers)
- Ověřeno e2e: generate → sken unassigned → claim → resolve; izolace (B claim kódu A → 404); dvojitý claim → 400
- Follow-up: veřejná self-aktivace koncovým příjemcem (mimo tenant kontext)

## Acceptance kritéria
- [x] Lze vytvořit objekt, přidat mu 1..N nosičů (QR/NFC/hybrid)
- [x] `public_code` unikátní, nesekvenční, base62 délky 12 (retry na kolizi)
- [x] QR export vrací validní kód (SVG `image/svg+xml` i PNG `image/png`)
- [~] Pole `valid_from`/`valid_to`/`status` existují; jejich vynucení řeší resolver (EPIC-05)
- [x] Vše tenant-scoped (izolační test: B nevidí objekty/nosiče A → 404)
- [x] Definováno rozhraní `handleScan(object, carrier, ctx)` + `ModuleRegistry`

## Závislosti
- EPIC-03-CORE-DOMAIN

## Podúkoly
- [x] TASK-01-DIGITAL-OBJECT – entita + CRUD (list/create/get/patch/archive) ✅
- [x] TASK-02-DATA-CARRIER – entita + public_code generátor (retry) ✅
- [x] TASK-03-QR-GEN – generování QR (SVG/PNG přes `qrcode`) ✅
- [x] TASK-04-NFC-PAIR – NFC párování + handleScan kontrakt ✅
