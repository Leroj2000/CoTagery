# EPIC-05-RESOLVER – Specifikace

## Cíl
Implementovat hot path `GET /r/{public_code}` podle ADR-0002: rychlé cachované čtení + asynchronní zápis `ScanEvent`.

## Scope

### In scope
- Endpoint `GET /r/{public_code}` (veřejný, bez auth)
- Lookup `public_code → DigitalObject` s **Redis cache** (TTL + invalidace)
- Validace `status` a časové platnosti; expirovaný/neaktivní → důstojná chybová stránka
- Volání modulového `handleScan()` podle `module_type`
- **Async ScanEvent pipeline** (fronta/stream, at-least-once, idempotence)
- Content negotiation: HTML vs JSON
- Bezpečnost: rate limit per IP i per `public_code`, blocklist cílů (anti-quishing)
- Graceful degradace: read-replica fallback, buffer ScanEvent při výpadku fronty

### Out of scope
- Bohaté modulové stránky (dodají jednotlivé moduly)
- Analytické agregace/dashboard (EPIC-06)

## Stav: 🟡 jádro hotové a ověřené (2026-08-08)

Lookup nosiče mimo RLS řeší `SECURITY DEFINER` funkce `resolve_carrier`; zápis ScanEventu `SECURITY DEFINER` funkce `log_scan` (obě vlastněné superuserem, EXECUTE jen pro `tagery_app`).

## Acceptance kritéria
- [x] Redis cache mapování public_code → Resolution (krátké TTL)
- [~] Cache invalidace při změně objektu/nosiče – zatím mitigováno TTL 20 s; write-invalidation je follow-up
- [x] ScanEvent se zapíše asynchronně (fire-and-forget), neblokuje odpověď
- [~] Idempotence eventu – u fire-and-forget zápisu není řešena; durable fronta (BullMQ / Cloudflare Queues) je follow-up (ADR-0002)
- [x] Rate limit vrací 429 (per IP + per public_code, Redis fixed-window)
- [x] Neplatný → 404, neaktivní/expirovaný → 410; content negotiation (JSON vs 302 redirect)
- [ ] Degradace na read-replica – follow-up (single DB zatím)

## Závislosti
- EPIC-04-DIGITAL-OBJECT
- Redis (z EPIC-00)

## Podúkoly
- [x] TASK-01-RESOLVE – lookup (resolve_carrier) + cache + validace ✅
- [x] TASK-02-SCAN-PIPELINE – async ScanEvent (log_scan) ✅ (durable fronta = follow-up)
- [x] TASK-03-HARDENING – rate limit + anti-quishing ✅ (degradace na replica = follow-up)
