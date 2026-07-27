# ADR-0008 – Deployment topologie: Cloudflare na edge + kontejnerizovaný backend

- **Stav:** Přijato
- **Datum:** 2026-07-26

## Kontext
Kde platformu provozovat. Zvažován i „all-in Cloudflare" (Workers + D1/Hyperdrive), ale ten by vynutil přepis backendu z NestJS na Workers-native (Hono) a u D1 by padla izolace přes PostgreSQL RLS (ADR-0001). Priorita: zachovat specifikaci a využít Cloudflare tam, kde je nejsilnější.

## Rozhodnutí
**Cloudflare na edge, aplikační backend v kontejneru mimo Workers** (varianta „edge + container").

Rozložení komponent:
| Komponenta | Kde |
|---|---|
| DNS, CDN, WAF, DDoS, TLS, rate-limiting (anti-quishing) | **Cloudflare** (vepředu) |
| Frontend Next.js | **Cloudflare Pages** (nebo Workers via `next-on-pages`) |
| Média (Gallery uploads, QR/fabrication výstupy) | **Cloudflare R2** (S3-kompatibilní) + signed URLs |
| Backend NestJS (modulární monolit) | **Kontejner** (Fly.io / Railway / Hetzner VPS) za Cloudflare |
| PostgreSQL (+ RLS) | Managed (**Neon** / Supabase) nebo na hostu – **reálný Postgres, RLS zachováno** |
| Redis (cache/fronty) | **Upstash** nebo na hostu |

## Resolver hot path (ADR-0002) na této topologii
- **v1:** resolver běží v NestJS backendu; **Cloudflare CDN cachuje odpovědi na edge**. Cache vrstva z ADR-0002 = Cloudflare edge (globální) + Redis na originu. Splní p95 < 100 ms pro cache hity na edge.
- **Pozdější optimalizace:** extrakce resolveru do dedikovaného **Cloudflare Workeru** (edge lookup + Cloudflare Queues pro ScanEvent). Konzistentní s ADR-0004 („extrakce služeb později"). Nevynucuje se pro MVP.

## Důsledky
- **Zachovává všechny stávající ADR:** 0001 (RLS na reálném Postgresu), 0002 (cache = Cloudflare edge + Redis), 0004 (NestJS monolit). Žádný přepis frameworku.
- **R2 přístup abstrahovat** za storage rozhraní (`StoragePort`), ať nejsme zaseknutí u Cloudflare (možnost přejít na S3/GCS).
- Lokální vývoj beze změny: Docker Compose (Postgres + Redis); Cloudflare se řeší až při nasazení.
- Fabrication (těžký render STL/PDF) běží v backend kontejneru (ne na Workers) – bez limitů Workers CPU.

## Řeší otevřené otázky
- **Cloud provider** (PRD §9.1): nikoli AWS/GCP monolit, ale Cloudflare edge + kontejnerový host.
- **Úložiště médií** (PRD §9.3): **Cloudflare R2** + CDN.

## Otevřené (neblokuje MVP – lokálně Docker Compose)
1. Konkrétní kontejnerový host: Fly.io vs Railway vs Hetzner VPS.
2. Managed Postgres/Redis (Neon + Upstash) vs. na hostu.
