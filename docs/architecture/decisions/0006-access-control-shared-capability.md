# ADR-0006 – Access Control jako průřezová sdílená schopnost

- **Stav:** Přijato
- **Datum:** 2026-07-21

## Kontext
Řízení přístupu potřebuje víc modulů, každý s jinou „vstupenkou":
- **Ticketing** – vstup na akci proti platné vstupence (check-in).
- **Membership** – vstup do členské zóny proti aktivnímu členství (tier/platnost).
- (výhledově) Rental – výdejní box, Time-Tracking – vstup do budovy…

Kdyby si každý modul stavěl vlastní check-in, vzniká duplicita logiky (validace, logování, anti-passback, deny důvody). Zároveň sken karty/brány je vždy tentýž vzorec: *scan → ověř nárok → povol/odmítni → zaloguj*.

## Rozhodnutí
Vyčlenit **Access Control jako sdílenou průřezovou schopnost jádra** (ne modul s doménovou logikou), kterou moduly zásobují „nárokem" (entitlement) přes jednotný kontrakt:

```
evaluateAccess(subject, accessPoint, context)
  -> { decision: allow | deny, reason, entitlementRef }
```

- **AccessPoint** – místo/zóna s řízeným vstupem (může mít vlastní `DataCarrier`, module_type `access_point`).
- **Poskytovatelé nároku** (entitlement providers): Ticketing (platný `Ticket`), Membership (aktivní `Membership` s dostatečným tierem pro danou zónu). Modul implementuje `resolveEntitlement(subject, accessPoint)`.
- **AccessEvent** – auditní log rozhodnutí (allow/deny + důvod), navázaný na `ScanEvent` (analytika) i na audit log (bezpečnost).
- Dvě směry skenu: skenuje se **brána** (návštěvník přiloží kartu / brána má kód) nebo **karta** (čtečka u vstupu) – schopnost je na směru nezávislá.

## Důsledky
- Ticketing `CheckIn` a Membership vstup se sjednotí nad `AccessPoint` + `AccessEvent`; Ticketing `CheckIn` se stane specializací (entitlement = ticket).
- Nový modul potřebující přístup jen doimplementuje `resolveEntitlement`, nestaví check-in znovu.
- Vše tenant-scoped (ADR-0001); AccessPoint i AccessEvent mají `tenant_id`.
- Sdílí resolver hot path (ADR-0002) – validace přístupu musí být rychlá; nárok lze cachovat s krátkým TTL.

## Vztah k roadmapě
Access Control (EPIC-15) je závislostí Ticketing (EPIC-09) i Membership (EPIC-16) → v exekučním pořadí běží před nimi (číslo = ID, ne pořadí; viz ROADMAP).
