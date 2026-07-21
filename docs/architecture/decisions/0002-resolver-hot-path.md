# ADR-0002 – Resolver jako cachovaný hot path

- **Stav:** Přijato
- **Datum:** 2026-07-19

## Kontext
`GET /r/{public_code}` je nejfrekventovanější a nejviditelnější endpoint – běží při každém skenu QR / tapu NFC. Musí být rychlý (PRD NFR: p95 < 100 ms), vysoce dostupný (99.9 %) a odolný proti quishing zneužití. Zároveň musí zapsat `ScanEvent` pro analytiku, což je zápisová operace na horké cestě.

## Rozhodnutí
1. **Rozdělit čtení a zápis.** Resolve (lookup `public_code` → `DigitalObject`) je čtení a jde přes cache. Zápis `ScanEvent` je **asynchronní** (fire-and-forget do fronty/streamu), aby nezdržoval odpověď uživateli.
2. **Cachovat mapování `public_code → resolved target`** (Redis, TTL + invalidace při změně objektu/nosiče). Neměnnost `public_code` z toho dělá ideální cache key.
3. **Stateless resolver** za load balancerem; statický/HTML výstup cachovatelný na CDN, JSON výstup krátce na edge.
4. **Graceful degradace:** při výpadku primární DB čti z read-replica; při výpadku fronty bufferuj ScanEvent lokálně a doruč později (at-least-once).
5. **Bezpečnost hot path:** rate limit per IP a per `public_code`, blocklist cílů, volitelně podepsané URL u citlivých modulů.

## Důsledky
- Analytika je **eventually consistent** (řádově sekundy zpoždění) – akceptováno, dashboard to reflektuje.
- ScanEvent pipeline musí být idempotentní (deduplikace přes event id / carrier + timestamp okno).
- Cache invalidace je kritická: změna `status`/`valid_to`/cíle objektu musí okamžitě promazat klíč.

## Alternativy zamítnuty
- Synchronní zápis ScanEvent do odpovědi → zvyšuje latenci a váže dostupnost resolveru na zápisovou DB.
- Bez cache, čtení vždy z DB → nesplní p95 < 100 ms při 1000 req/s.
