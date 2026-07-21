# Access Control – sdílená schopnost jádra (AS IS)

Průřezová schopnost pro řízení vstupu, sdílená moduly **Ticketing** a **Membership** (výhledově dalšími). Není to modul s doménovou logikou – je to jednotný mechanismus *scan → ověř nárok → povol/odmítni → zaloguj*. Rozhodnutí: ADR-0006.

---

## 1. Princip
Jádro nezná „vstupenku" ani „členství" – zná jen **nárok (entitlement)**. Každý modul, který chce řídit přístup, implementuje kontrakt:

```
resolveEntitlement(subject, accessPoint, context) -> Entitlement | null
```

a Access Control z toho udělá rozhodnutí:

```
evaluateAccess(subject, accessPoint, context)
  -> { decision: allow | deny, reason, entitlementRef }
```

## 2. Entity

```
AccessPoint
  id, tenant_id
  location_id
  name
  zone_key                 # logická zóna (např. "vip", "backstage", "sklad-A")
  digital_object_id (nullable)   # brána může mít vlastní DataCarrier (module_type=access_point)
  direction: in | out | both
  settings_json            # anti-passback, časová okna, kapacita
  created_at, updated_at

AccessEvent
  id, tenant_id
  access_point_id
  subject_ref              # kdo (member / ticket holder / user)
  entitlement_ref          # čím prošel (membership_id / ticket_id)
  decision: allow | deny
  reason                   # expired, wrong_zone, capacity_full, not_found…
  scan_event_id            # vazba na ScanEvent (analytika)
  created_at
```

## 3. Poskytovatelé nároku (entitlement providers)

| Modul | Nárok (entitlement) | Podmínka `allow` |
|---|---|---|
| **Ticketing** | platný `Ticket` | status=paid, ještě neredeemed (nebo re-entry povolen), event běží |
| **Membership** | aktivní `Membership` | status=active, v platnosti, tier pokrývá `zone_key` |

Ticketing `CheckIn` se stává specializací `AccessEvent` (entitlement = ticket).

## 4. Tok (na scan)
```
Resolver /r/{public_code} u AccessPoint (nebo scan karty u čtečky)
  → identifikuj subject (member card / ticket)
  → modul.resolveEntitlement(subject, accessPoint)
  → evaluateAccess → allow|deny (+ reason)
  → zapiš AccessEvent + ScanEvent(event_type=checkin/checkout)
  → UI: zelená/červená + důvod
```

## 5. Pravidla
1. **Rychlost:** vyhodnocení běží na hot path (ADR-0002) → nárok lze cachovat s krátkým TTL, invalidace při změně členství/ticketu.
2. **Anti-passback:** volitelně bránit dvojímu vstupu bez výstupu (`settings_json`).
3. **Kapacita / časová okna:** volitelné limity zóny.
4. **Audit:** každé `deny` i `allow` je auditní událost (bezpečnost).
5. **Multi-tenant:** `AccessPoint` i `AccessEvent` mají `tenant_id` (ADR-0001).

## 6. API kontrakty
```
GET  /api/v1/access-points                 – seznam (filtr: location, zone)
POST /api/v1/access-points                 – vytvořit
POST /api/v1/access-points/:id/evaluate    – vyhodnotit vstup ({ subjectRef }) → allow|deny
GET  /api/v1/access-points/:id/events      – log průchodů (filtr: decision, from, to)
```

## 7. RBAC
| Oprávnění | Akce |
|---|---|
| `manage` | správa access pointů, zón, pravidel |
| `edit` | úprava konkrétního bodu |
| `view` | logy průchodů, reporty |
| `scan_only` | provádět vstup/výstup (obsluha brány) |
