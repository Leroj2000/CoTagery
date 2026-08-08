# EPIC-07-ANALYTICS – Specifikace

## Stav: 🟡 jádro hotové a ověřené (2026-08-08)

## Cíl
Agregace `ScanEvent` a přehledy pro dashboard – tenant-scoped čtení nad RLS.

## Hotovo
- [x] `GET /api/v1/analytics/overview` – počty objektů/nosičů/skenů, skeny dle modulu, top objekty, poslední aktivita
- [x] `GET /api/v1/analytics/scans` – log skenů (filtr: objectId, from, to)
- [x] Vše tenant-scoped přes RLS (ověřeno: tenant B vidí 0)

## Follow-up
- [ ] Časové řady (`/analytics/timeseries`), agregace do materializovaných pohledů
- [ ] Napojení na durable ScanEvent pipeline (EPIC-05 follow-up)

## Závislosti
- EPIC-05 RESOLVER (produkuje ScanEvent)
