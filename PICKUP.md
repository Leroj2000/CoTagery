# Tagery – Kontinuita sessions

## Poslední session
- **Datum:** 2026-08-08
- **Agent:** Claude (Opus 4.8)
- **Dokončeno:** **EPIC-04 Digital-Object implementován a ověřen.** DigitalObject + DataCarrier CRUD, `public_code` generátor (base62/12), QR generování (SVG/PNG přes `qrcode`), NFC párování, `ModuleRegistry` + `handleScan` kontrakt — vše tenant-scoped nad RLS. Předtím: EPIC-03 Core-Domain (RLS), EPIC-01 Auth, EPIC-00.

## Stav projektu
- **Specifikace:** kompletní (PRD, 8 ADR, moduly, roadmapa 18 EPIKů).
- **Kód na `main`:** EPIC-00, EPIC-01, EPIC-03 (RLS). **EPIC-04** na větvi `epic-04-digital-object` (nezmergováno).
- **Ověřeno (EPIC-04):** build/typecheck/lint/test zeleně (10 testů); migrace InitDigitalObject; e2e — create object→carrier(public_code)→QR SVG/PNG→NFC pair; izolace: tenant B nevidí objekty/nosiče A (0 / 404).
- **Git:** větev `epic-04-digital-object` z `main`.
- **KRITICKÉ pozn. k RLS:** runtime se připojuje přes `APP_DATABASE_URL` jako `tagery_app` (NE-superuser). `.env` musí mít `APP_DATABASE_URL` + `JWT_SECRET` (viz `.env.example`). **Migrace musí proběhnout před startem appky** (vytváří roli `tagery_app`).

## Jak spustit (dev)
```
cp .env.example .env
pnpm install
docker compose up -d postgres redis
pnpm --filter @tagery/api migration:run
pnpm --filter @tagery/api seed
pnpm dev            # nebo: pnpm --filter @tagery/api dev
# health: curl http://localhost:3001/api/v1/health
```
pnpm se instaluje přes `npm i -g pnpm@9` (corepack v tomto prostředí nebyl).

## Další krok
Mergnout `epic-04-digital-object` do `main`, pak **EPIC-05 Resolver** (`GET /r/{public_code}` – veřejný hot path, cache, async ScanEvent; použije `ModuleRegistry.handleScan`). Pozn. resolver hledá nosič podle public_code BEZ tenant kontextu → potřebuje cestu mimo RLS (service role / SECURITY DEFINER) – vyřešit v EPIC-05. Volitelně doplnit zbytek EPIC-03/EPIC-01 později.

## Otevřené otázky (neblokují; PRD §9 / ZADANI §15)
Kontejnerový host (Fly/Railway/Hetzner) · managed Postgres/Redis (Neon+Upstash) · SSO rozsah · doménová strategie · NFC iOS · Billing pricing pásma · Rental spory.

## Konvence
- EPIC číslo = ID (pořadí vzniku); exekuční pořadí řídí ROADMAP.
- Backlog: sjednotit `Member`/`Customer`/`RenterProfile` → `Party`/`Person`.
- Storage přes `StoragePort` (lokálně filesystem, prod R2/S3 – ADR-0008).
