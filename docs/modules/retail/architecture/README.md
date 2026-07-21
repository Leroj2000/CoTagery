# Retail – Architektura modulů

## Datový model

### Klíčové vztahy
```
DigitalObject (module_type = product/loyalty/pay/inventory/trace)
  └── Product / LoyaltyAccount / Bill / StockItem / Batch
        └── ScanEvent (každý sken zalogován)
```

### GS1 Digital Link (budoucí)
Pro product modul je plánována podpora GS1 Digital Link standardu:
- GTIN v URL: `/r/{public_code}?gtin=...`
- Šarže a expirace jako query parametry
- Kompatibilita s retailovými čtečkami

## Integrační body
- **Platební gateway** – Payment modul (Stripe, GoPay pro CZ/SK trh)
- **ERP / PIM systémy** – Product modul přes API webhooky
- **EU Digital Product Passport** – Trace modul, compliance s EU regulací
