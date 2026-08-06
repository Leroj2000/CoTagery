# Tagery – Kontinuita sessions

## Poslední session
- **Datum:** 2026-08-06
- **Agent:** Claude (Opus 4.8)
- **Dokončeno:** **EPIC-01 TASK-01-JWT implementován a ověřen.** JWT access+refresh s rotací a reuse detekcí, `JwtAuthGuard` plnící tenant kontext, `@CurrentUser`/`@TenantId`, Argon2id, endpointy login/refresh/logout/me. Předtím: EPIC-00 Foundation, ADR-0008.

## Stav projektu
- **Specifikace:** kompletní (PRD, 8 ADR, moduly, roadmapa 18 EPIKů).
- **Kód:** EPIC-00 hotový (na `main`). EPIC-01 TASK-01-JWT hotový (na větvi `epic-01-auth`). Zbytek EPIC-01: TASK-02 OAuth2, TASK-03 invite.
- **Ověřeno (EPIC-01):** build/typecheck/lint/test zeleně (5 testů); migrace InitAuth + seed (demo user `owner@demo.tagery` / `demo1234`); e2e auth flow — login→/me→refresh→reuse-detekce→401, špatné heslo→401, validace→400.
- **Git:** `main` má EPIC-00. Větev `epic-01-auth` má TASK-01-JWT (nezmergováno).
- **Pozn.:** do `.env` bylo nutné přidat `JWT_SECRET`/`JWT_ACCESS_TTL`/`JWT_REFRESH_TTL` (jsou v `.env.example`).

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
Mergnout `epic-01-auth` do `main`, pak pokračovat: **EPIC-03-CORE-DOMAIN** (Tenant/User/Location + RLS – rozšíří minimální `User` z auth) → **EPIC-04 Digital-Object** → **EPIC-05 Resolver**. Volitelně dokončit EPIC-01 (TASK-02 OAuth2, TASK-03 invite) později.

## Otevřené otázky (neblokují; PRD §9 / ZADANI §15)
Kontejnerový host (Fly/Railway/Hetzner) · managed Postgres/Redis (Neon+Upstash) · SSO rozsah · doménová strategie · NFC iOS · Billing pricing pásma · Rental spory.

## Konvence
- EPIC číslo = ID (pořadí vzniku); exekuční pořadí řídí ROADMAP.
- Backlog: sjednotit `Member`/`Customer`/`RenterProfile` → `Party`/`Person`.
- Storage přes `StoragePort` (lokálně filesystem, prod R2/S3 – ADR-0008).
