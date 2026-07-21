# EPIC-15-ACCESS-CONTROL – Specifikace

## Cíl
Vyčlenit **sdílenou schopnost řízení vstupu** (ADR-0006), kterou využije Ticketing i Membership: *scan → ověř nárok → povol/odmítni → zaloguj*. Jednotný kontrakt místo duplicitního check-inu v každém modulu.

Referenční dokumentace: `docs/reference/access-control.md`.

## Scope

### In scope
- Entity `AccessPoint` (zóna/brána, `zone_key`, direction, settings) a `AccessEvent` (audit průchodů)
- Kontrakt `resolveEntitlement(subject, accessPoint)` implementovaný poskytovateli (Ticketing, Membership)
- `evaluateAccess()` → allow/deny + reason
- Napojení na resolver (hot path) + `ScanEvent` (analytika)
- Anti-passback, časová okna, kapacita zóny (volitelné přes settings)
- API: access-points CRUD, `evaluate`, events log

### Out of scope
- Doménová logika ticketů a členství (dodají Ticketing / Membership jako providery)
- Fyzické turnikety/HW brány (integrace později)

## Acceptance kritéria
- [ ] `evaluateAccess` vrátí allow/deny + strukturovaný důvod
- [ ] Ticketing i Membership fungují jako entitlement provideři přes stejný kontrakt
- [ ] Každý průchod (allow i deny) je v `AccessEvent` + audit logu
- [ ] Vyhodnocení splňuje hot-path latenci (nárok cachovatelný, invalidace při změně)
- [ ] Anti-passback zabrání dvojímu vstupu bez výstupu (když zapnuto)
- [ ] Vše tenant-scoped (izolační test)

## Závislosti
- EPIC-04 DIGITAL-OBJECT, EPIC-05 RESOLVER (hot path, ScanEvent)

## Podúkoly (návrh)
- [ ] TASK-01-ACCESS-POINT – entity + CRUD + zóny
- [ ] TASK-02-EVALUATE – evaluateAccess + provider kontrakt + cache
- [ ] TASK-03-EVENTS – AccessEvent, anti-passback, audit, reporty
