# EPIC-00-FOUNDATION – Specifikace

## Cíl
Postavit technický základ, na kterém poběží všechny další EPICy: monorepo, skeleton aplikací, lokální běhové prostředí, CI/CD, migrace, kvalita kódu.

## Scope

### In scope
- **Monorepo** (pnpm workspaces / Nx / Turborepo) – `apps/api` (NestJS), `apps/web` (Next.js), `packages/shared` (typy, DTO)
- **NestJS skeleton** – health endpoint, config module (env validace přes zod/joi), logger (pino)
- **Next.js skeleton** – App Router, Tailwind, mobile-first layout shell
- **PostgreSQL + Redis** přes Docker Compose (lokální dev)
- **Migrační nástroj** (TypeORM migrations / Prisma) + seed skript
- **CI/CD** – lint, typecheck, test, build (GitHub Actions skeleton)
- **Kvalita** – ESLint, Prettier, husky pre-commit, commit convention
- **`BaseTenantEntity`** základ (bez plné RLS – ta v EPIC-03)

### Out of scope
- Cloud infrastruktura / IaC (cloud zatím neřešíme – jen Docker Compose lokálně)
- Produkční deployment

## Acceptance kritéria
- [ ] `docker compose up` nastartuje API + web + Postgres + Redis
- [ ] `GET /api/v1/health` vrací 200 se stavem DB a Redis
- [ ] Web zobrazí prázdný shell (mobile-first), načte se z API health
- [ ] Migrace lze spustit i rollbacknout, seed naplní demo tenant
- [ ] CI projde na prázdném skeletu (lint+typecheck+test+build zeleně)
- [ ] Env proměnné validované při startu, `.env.example` zdokumentován

## Závislosti
Žádné (první EPIC).

## Podúkoly (návrh)
- [ ] TASK-01-MONOREPO – workspace, apps, shared package
- [ ] TASK-02-DOCKER – Compose (Postgres, Redis), .env
- [ ] TASK-03-MIGRATIONS – migrační nástroj + seed
- [ ] TASK-04-CI – GitHub Actions pipeline
