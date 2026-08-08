# EPIC-08-PRODUCT – Specifikace

## Stav: 🟡 jádro hotové a ověřené (2026-08-08) – první modul s handleScan

## Cíl
Product modul: produktová karta navázaná na DigitalObject. První modul, který
se registruje do `ModuleRegistry` a obsluhuje sken přes `handleScan` (ADR-0002).

## Hotovo
- [x] Entita `Product` (tenant-scoped, RLS) + migrace InitProduct
- [x] `POST /api/v1/products`, `GET /api/v1/products/by-object/:id`
- [x] `ProductHandler` registruje se do ModuleRegistry; `handleScan` vrací kartu
- [x] Resolver spouští handler v tenant kontextu (`runInTenant`) → produkt čten přes RLS
- [x] Ověřeno e2e: sken `/r/{code}` product objektu → JSON produktová karta

## Follow-up
- [ ] Média (obrázky/videa přes StoragePort/R2), recenze, GS1 Digital Link
- [ ] HTML render karty (zatím JSON)

## Závislosti
- EPIC-04 DIGITAL-OBJECT, EPIC-05 RESOLVER (handleScan integrace)
