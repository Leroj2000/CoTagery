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
- **`StoragePort`** rozhraní pro média (implementace R2/S3 později, lokálně filesystem/MinIO) – ať Fabrication/Gallery nejsou zaseknuté na Cloudflare (ADR-0008)

### Deployment target (ADR-0008)
Nasazení = Cloudflare na edge (Pages pro `apps/web`, CDN/WAF, R2 pro média) + `apps/api` jako **kontejner** (Fly/Railway/VPS) + Postgres(RLS)/Redis. Skeleton to nemá řešit produkčně, ale strukturou tomu nesmí bránit: web buildovatelný pro Pages, API jako Docker image, média za `StoragePort`.

### Out of scope
- IaC / produkční nasazení na Cloudflare (řeší pozdější deploy EPIC) – teď jen Docker Compose lokálně
- Extrakce resolveru do Cloudflare Workeru (pozdější optimalizace, ADR-0002/0008)

## Stav: ✅ Implementováno (2026-07-28)
Monorepo (pnpm + turbo): `apps/api` (NestJS 11), `apps/web` (Next 15), `packages/shared`. Ověřeno: build, typecheck, lint, test zeleně; Postgres+Redis přes Compose; migrace+revert+seed; API health vrací 200 (`database: up, redis: up`).

## Acceptance kritéria
- [x] `docker compose up` – Postgres + Redis ověřeno healthy; API+web mají Dockerfile + compose entry (plný image build neověřen v této session)
- [x] `GET /api/v1/health` vrací 200 se stavem DB a Redis — ověřeno
- [x] Web build + mobile-first shell fetchující `/api/v1/health` (build ověřen; render v prohlížeči neověřen)
- [x] Migrace lze spustit i rollbacknout (`migration:run`/`revert`), seed naplní demo tenant — ověřeno
- [x] lint + typecheck + test + build zeleně — ověřeno (CI workflow `.github/workflows/ci.yml`)
- [x] Env validace přes zod při startu, `.env.example` zdokumentován

## Závislosti
Žádné (první EPIC).

## Podúkoly (návrh)
- [ ] TASK-01-MONOREPO – workspace, apps, shared package
- [ ] TASK-02-DOCKER – Compose (Postgres, Redis), .env
- [ ] TASK-03-MIGRATIONS – migrační nástroj + seed
- [ ] TASK-04-CI – GitHub Actions pipeline
