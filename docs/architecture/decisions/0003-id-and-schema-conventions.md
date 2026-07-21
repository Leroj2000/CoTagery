# ADR-0003 – Identifikátory, konvence schématu a `public_code`

- **Stav:** Přijato
- **Datum:** 2026-07-19

## Kontext
Potřebujeme konzistentní strategii ID napříč entitami, bezpečné veřejné identifikátory pro URL a jednotné konvence schématu, aby agenti i vývojáři generovali kompatibilní kód.

## Rozhodnutí

### Interní primární klíče
- **UUID v7** (time-ordered) pro všechny PK. Výhoda oproti UUIDv4: lepší lokalita indexu při zápisu, přitom neprozrazuje pořadí tak jako sekvence.

### Veřejné identifikátory (`public_code`)
- `public_code` je **náhodný, nesekvenční, krátký** řetězec (base62, délka ≥ 10 znaků, ~59 bitů entropie) – nesmí jít uhodnout ani enumerovat.
- Oddělený od interního UUID → interní klíče nikdy neopouštějí systém přes veřejné URL.
- Kolize řešeny unikátním indexem + retry při generování.

### Konvence schématu
- Názvy tabulek: `snake_case`, množné číslo (`digital_objects`, `scan_events`).
- Každá doménová tabulka: `id UUID PK`, `tenant_id UUID NOT NULL` (index), `created_at`, `updated_at`.
- **Soft delete** přes `deleted_at TIMESTAMPTZ NULL` u entit, kde dává smysl auditní historie (objekty, půjčky, tickety); hard delete jen u efemérních dat.
- Časové sloupce: `TIMESTAMPTZ` (UTC), převod do timezone řeší aplikace dle `Location.timezone`.
- Flexibilní data: `*_json JSONB` – jen pro nestrukturovaná/rozšiřující data, ne pro dotazovatelné klíčové atributy.
- Enumy: PostgreSQL enum nebo `text` + CHECK; volba per tabulka dokumentovaná v migraci.

### Auditovatelnost
- Klíčové mutace (změna práv, stav ticketu, půjčka) zapisují do append-only `audit_log` (kdo, co, kdy, tenant, před/po).

## Důsledky
- Jednotný základ pro `BaseTenantEntity` a generátory migrací.
- `public_code` bezpečný pro tisk na miliony nosičů bez rizika enumerace.
