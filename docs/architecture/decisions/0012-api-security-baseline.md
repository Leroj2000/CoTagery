# ADR 0012: Bezpečnostní minimum API pro MVP

- Stav: přijaté
- Datum: 2026-09-06

## Rozhodnutí

- Produkční API vyžaduje `APP_DATABASE_URL`; vlastnické `DATABASE_URL` je vyhrazené migracím a seedům.
- Povolené webové originy jsou explicitní v `CORS_ORIGINS`. Produkce odmítne wildcard `*`.
- API neposílá identifikaci Expressu a přidává hlavičky proti MIME sniffingu, frame embeddingu a úniku referreru; Bluetooth a kamera jsou povolené pouze vlastnímu originu.
- Login, registrace, reset účtu, ověření tokenů, renter login/registrace, objednávky a veřejné nálezy/aktivace mají Redis rate limit. E-mailové identity se v klíčích ukládají jen jako zkrácený SHA-256 otisk.
- `pnpm --filter @tagery/api test:rls` pod aplikačním DB účtem ověřuje všechny RLS tabulky proti čtení i změně cizího tenantu a kontroluje fixní `search_path` u `SECURITY DEFINER` funkcí.

## Důsledky

Produkční start selže při nebezpečné DB nebo CORS konfiguraci. RLS audit potřebuje dostupnou migrovanou databázi, aplikační connection string a alespoň dva tenanty; zapisovací pokusy probíhají v transakcích ukončených rollbackem.

