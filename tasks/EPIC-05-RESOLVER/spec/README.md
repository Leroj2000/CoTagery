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

## Acceptance kritéria
- [ ] Cache hit p95 < 100 ms (NFR z PRD)
- [ ] Cache invalidace při změně objektu/nosiče (status, valid_to, cíl) je okamžitá
- [ ] ScanEvent se zapíše asynchronně, neblokuje odpověď
- [ ] Duplicitní doručení eventu nezaloží 2 záznamy (idempotence)
- [ ] Rate limit vrací 429 s retry hlavičkami
- [ ] Výpadek zápisové DB neshodí resolve (degradace na replica)
- [ ] Neplatný/expirovaný kód → 410/404 s uživatelsky přívětivou stránkou

## Závislosti
- EPIC-04-DIGITAL-OBJECT
- Redis + fronta (z EPIC-00)

## Podúkoly (návrh)
- [ ] TASK-01-RESOLVE – lookup + cache + validace
- [ ] TASK-02-SCAN-PIPELINE – async ScanEvent (queue, idempotence)
- [ ] TASK-03-HARDENING – rate limit, anti-quishing, degradace
