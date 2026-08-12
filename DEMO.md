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

## Reset dema
```bash
docker compose exec -T postgres psql -U tagery -d tagery -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
pnpm --filter @tagery/api migration:run && pnpm --filter @tagery/api seed && pnpm --filter @tagery/api seed:demo
```

## Poznámky
- Platby jedou přes **stub PSP** (žádné reálné Stripe) – `invoice.paid` webhook se dá poslat ručně (podpis HMAC `BILLING_WEBHOOK_SECRET`, viz `.env`).
- Invite uživatele vrací **dočasné heslo** (zatím bez e-mailu/SMTP).
- Vše je tenant-izolované přes PostgreSQL RLS (runtime běží jako ne-superuser `tagery_app`).
