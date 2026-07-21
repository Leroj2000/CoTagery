# src/core – Popis

## Co tento kód dělá
Jádro Tagery platformy – společná funkcionalita sdílená napříč všemi moduly.

## Klíčové podsložky
<!-- Vyplň při implementaci -->
- `auth/` – JWT autentizace, guards, decorators
- `qr-nfc/` – generování a správa tagů
- `tenancy/` – middleware pro tenant izolaci
- `database/` – TypeORM konfigurace, base entity

## Exportované API
<!-- Které services/modules jsou dostupné jiným modulům -->

## Kritické závislosti
- Každá entita musí dědit z `BaseTenantEntity` (obsahuje `tenant_id`)
