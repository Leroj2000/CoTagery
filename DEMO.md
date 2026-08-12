# Tagery – Demo runbook

Spuštění demo instance s předpřipravenými daty za ~2 minuty.

## Předpoklady
- Node (viz `.nvmrc`) + `pnpm` (`npm i -g pnpm@9`)
- Docker (pro PostgreSQL + Redis)

## Spuštění (dev)
```bash
cp .env.example .env
pnpm install
docker compose up -d postgres redis
pnpm --filter @tagery/api migration:run   # schéma + RLS
pnpm --filter @tagery/api seed            # demo tenant + owner
pnpm --filter @tagery/api seed:demo       # 👈 demo data (idempotentní)
pnpm dev                                  # API :3001, web :3000
```
`seed:demo` na konci vypíše **PINy k self-aktivačním nosičům** a **dočasné heslo** pozvaného editora – ulož si je pro demo.

## Nebo celé v Dockeru
```bash
docker compose up --build            # postgres, redis, api, web
# v jiném terminálu (jednorázově):
pnpm --filter @tagery/api migration:run && pnpm --filter @tagery/api seed && pnpm --filter @tagery/api seed:demo
```

## Přihlášení
- **Admin:** http://localhost:3000/admin
- **Owner:** `owner@demo.tagery` / `demo1234`
- Další seedovaní uživatelé: `editor@demo.cz` (EDITOR, heslo vypsané seedem), `viewer@demo.cz` (VIEWER)

## Co je předpřipravené
| Oblast | Data |
|---|---|
| Tenant | „Demo Tenant", branding `tagy.demo.cz` |
| Tiery | **Basic** (zdarma), **VIP** (990, zóna `vip`, 20 % sleva + vstup do zóny) |
| Členové | Jana Nováková (VIP), Petr Svoboda (Basic), Eva Dvořáková (VIP přes předplatné) |
| Karta | VIP karta Jany na QR nosiči |
| Nosiče | 2 produktové + pool (5 volných + 3 self-aktivační s PIN) |
| Objekty | 2 produkty (`demo-kava-etiopie`, `demo-tricko-bio`) + členská karta |
| Přístup | „Hlavní brána" (zóna `vip`) + audit se 3 vstupy VIP karty |
| Billing | Předplatné Evy (VIP) v aktivním stavu + zaplacená faktura (DPH 21 %) |
| Uživatelé/skupiny | owner + editor + viewer; skupina „Zaměstnanci" |
| Analytika | ~16 skenů (dashboard graf: product / membership) |

## Demo scénář (click-through)
1. **Dashboard** (`/admin`) – přehled: objekty, nosiče, skeny + graf podle modulu.
2. **Objekty** (`/admin/objects`) → detail produktu → **QR náhled** nosiče, přidání nosiče, inline **NFC pairing**.
3. **Nosiče (pool)** (`/admin/carriers`) – nepřiřazené nosiče, **claim** na objekt; nový self-aktivační pool s PINy k tisku.
4. **Členství** (`/admin/membership`) – tiery/členové, **vydání členství**, **vydání karty** na volný nosič, benefity.
5. **Veřejný sken karty** – otevři `http://localhost:3000/s/<public_code>` (kód najdeš u nosiče karty) → mobilní pohled na kartu (tier, platnost, benefity, zóny).
6. **Self-aktivace** – `http://localhost:3000/activate/<self_act_code>` → zadej PIN (z výpisu seedu) → aktivace kódu koncovým příjemcem.
7. **Přístup** (`/admin/access`) → detail brány → **audit log** vstupů.
8. **Předplatné** (`/admin/billing`) → detail → **faktura** s rozpadem DPH; nový **checkout**.
9. **Uživatelé / Skupiny / Nastavení** – správa rolí, skupin, branding tenanta.

## Spuštění na VPS (veřejné demo)

Nejspolehlivější cesta: **PostgreSQL + Redis v Dockeru, API a web v dev módu z hostu**
(prod Docker image API nemá `ts-node`, takže migrace/seed z něj neproběhnou; a
`NEXT_PUBLIC_*` se do Nextu bakuje při buildu).

Předpoklad: VPS s Ubuntu, veřejná IP (dále `VPS_IP`). Nahraď `VPS_IP` svou IP/doménou.

### 1) Základní software
```bash
# Docker + compose plugin
curl -fsSL https://get.docker.com | sh
# Node 22 + pnpm
curl -fsSL https://fnm.vercel.app/install | bash && exec $SHELL
fnm install 22 && fnm use 22
npm i -g pnpm@9
```

### 2) Firewall – otevři porty webu a API
```bash
sudo ufw allow 22 && sudo ufw allow 3000 && sudo ufw allow 3001 && sudo ufw enable
```

### 3) Kód + konfigurace
```bash
git clone <REPO_URL> tagery && cd tagery
cp .env.example .env
```
Uprav kořenový **`.env`** (API):
```
NODE_ENV=development                 # kvůli plain http (secure cookies vypnuté)
API_PORT=3001
DATABASE_URL=postgres://tagery:tagery@localhost:5432/tagery
APP_DATABASE_URL=postgres://tagery_app:tagery_app@localhost:5432/tagery
REDIS_URL=redis://localhost:6379
JWT_SECRET=<vygeneruj: openssl rand -hex 24>
PUBLIC_BASE_URL=http://VPS_IP:3001   # do QR/resolver URL nosičů (nastav PŘED seedem)
BILLING_WEBHOOK_SECRET=<openssl rand -hex 16>
```
Vytvoř **`apps/web/.env.local`** (web):
```
NEXT_PUBLIC_API_URL=http://VPS_IP:3001   # browser (veřejné stránky /s, /activate)
API_URL=http://localhost:3001            # server-side volání web → API (BFF)
```

### 4) DB/cache + instalace + data
```bash
docker compose up -d postgres redis
pnpm install
pnpm --filter @tagery/api migration:run
pnpm --filter @tagery/api seed
pnpm --filter @tagery/api seed:demo
```

### 5) Spuštění (přežije odhlášení – tmux)
```bash
sudo apt-get install -y tmux
tmux new -s tagery
pnpm dev            # API :3001, web :3000  (Ctrl+B pak D pro detach)
```
> Nebo produkční start bez tmuxu: `pnpm --filter @tagery/api build && pnpm --filter @tagery/web build`,
> pak každou appku spusť přes `pm2`/`systemd` (`@tagery/api start`, `@tagery/web start`).
> Pozor: pro `NODE_ENV=production` potřebuješ HTTPS (viz níže), jinak nefunguje login.

### 6) Přístup
- Admin: `http://VPS_IP:3000/admin` (`owner@demo.tagery` / `demo1234`)
- Veřejný sken karty: `http://VPS_IP:3000/s/<public_code>`

### (Volitelně) HTTPS + doména přes Caddy
S doménou získáš automatické Let's Encrypt HTTPS – pak dej `NODE_ENV=production`
a veřejné URL na `https://…`.
```bash
# /etc/caddy/Caddyfile
demo.tvoje-domena.cz {
    handle /r/* { reverse_proxy localhost:3001 }
    handle /api/v1/* { reverse_proxy localhost:3001 }
    handle { reverse_proxy localhost:3000 }
}
```
Poté v `.env` a `apps/web/.env.local` nastav `PUBLIC_BASE_URL` / `NEXT_PUBLIC_API_URL`
na `https://demo.tvoje-domena.cz` a znovu seedni (kvůli QR URL).

## Reset dema
```bash
docker compose exec -T postgres psql -U tagery -d tagery -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
pnpm --filter @tagery/api migration:run && pnpm --filter @tagery/api seed && pnpm --filter @tagery/api seed:demo
```

## Poznámky
- Platby jedou přes **stub PSP** (žádné reálné Stripe) – `invoice.paid` webhook se dá poslat ručně (podpis HMAC `BILLING_WEBHOOK_SECRET`, viz `.env`).
- Invite uživatele vrací **dočasné heslo** (zatím bez e-mailu/SMTP).
- Vše je tenant-izolované přes PostgreSQL RLS (runtime běží jako ne-superuser `tagery_app`).
