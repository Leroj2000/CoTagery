# Architektura – Globální rozhodnutí

> Autoritativní *jak* pro jádro. Produktové *proč/co* je v `../PRD.md`. Nefunkční požadavky (výkon, dostupnost, compliance) viz `../PRD.md` §5.

## Klíčová rozhodnutí (ADR)
- [ADR-0001](decisions/0001-multi-tenancy-isolation.md) – Izolace tenantů: shared DB + RLS + `tenant_id`
- [ADR-0002](decisions/0002-resolver-hot-path.md) – Resolver jako cachovaný hot path (async ScanEvent)
- [ADR-0003](decisions/0003-id-and-schema-conventions.md) – UUIDv7, `public_code`, konvence schématu, soft delete, audit log
- [ADR-0004](decisions/0004-modular-monolith.md) – Modulární monolit teď, extrakce služeb později
- [ADR-0005](decisions/0005-renter-reputation-scope.md) – Rozsah identity a reputace nájemce
- [ADR-0006](decisions/0006-access-control-shared-capability.md) – Access Control jako průřezová sdílená schopnost
- [ADR-0007](decisions/0007-billing-money-flow.md) – Billing: členské platby tenant-owns-PSP (Stripe); monetizace = fee za vydané karty

## Multi-tenancy model
Každý tenant (firma/organizace) má striktně izolovaná data. Izolace je zajištěna na třech úrovních:
1. **Aplikační vrstva** – `tenant_id` extrahován z JWT, přidáván do každého dotazu
2. **ORM vrstva** – `BaseTenantEntity` s povinným `tenant_id` a TypeORM global scope
3. **DB vrstva** – PostgreSQL Row Level Security (RLS) jako pojistka

## Core datový model

### Tenant
```
Tenant
  id (UUID)
  name
  type: retail | event | rental | home | mixed
  branding_domain (subdoména, white-label)
  settings_json
  created_at, updated_at
```

### Location
```
Location
  id (UUID)
  tenant_id
  name
  type: store | venue | warehouse | office | home
  address
  timezone
  created_at, updated_at
```

### User
```
User
  id (UUID)
  tenant_id
  email
  name
  tenant_role: OWNER | ADMIN | MANAGER | EDITOR | VIEWER | SCAN_ONLY
  status
  created_at, updated_at
```

### Group / GroupMember (pro větší firmy)
```
Group: id, tenant_id, name
GroupMember: group_id, user_id
```

## DigitalObject – centrální entita
Každý QR/NFC kód vede na DigitalObject, který určuje, který modul se aktivuje.

```
DigitalObject
  id (UUID)
  tenant_id
  module_type: product | loyalty | pay | inventory | trace |
               ticket | rental | gallery | time_tracker | automation | contact |
               membership | access_point
  slug (lidsky čitelné URL)
  status: active | inactive | archived
  primary_url
  metadata_json
  valid_from, valid_to
  created_at, updated_at
```

## DataCarrier – fyzický nosič
Jeden DigitalObject může mít více nosičů (QR, NFC, hybrid).

```
DataCarrier
  id (UUID)
  digital_object_id
  carrier_type: qr | nfc | hybrid
  public_code (krátký identifikátor v URL)
  resolver_url
  qr_payload
  nfc_uid
  nfc_payload (NDEF URI)
  version
  status: active | replaced | lost | destroyed
  created_at, updated_at
```

## ScanEvent – log všech interakcí
```
ScanEvent
  id (UUID)
  digital_object_id
  data_carrier_id
  carrier_type: qr | nfc
  event_type: scan | tap | open | checkin | checkout | upload | pay | return | habit
  user_id / person_id
  device_info_json
  ip_address
  location_hint
  created_at
```

## Resolver – směrování QR/NFC skenů
`GET /r/{public_code}` – veřejný endpoint (bez auth)

Tok:
1. Najít `DataCarrier` podle `public_code`
2. Ověřit `status` a časovou platnost (`valid_from`, `valid_to`)
3. Načíst `DigitalObject` → podle `module_type` volat modulový handler
4. Zalogovat `ScanEvent`
5. Vrátit HTML (user-facing) nebo JSON (pro appku)

Každý modul implementuje: `handleScan(digitalObject, dataCarrier, requestContext) → response`

## Fabrication – export výrobních souborů
Průřezová funkce jádra nad `DataCarrier` (nezávislá na `module_type`): export nosičů do souborů pro **tisk štítků** (PDF/PNG/SVG/ZPL), **gravírky** (SVG/DXF) a **3D tisk** (STL/3MF). Zdrojem pravdy je vektorové SVG generované z QR matice; z něj plynou všechny formáty. Renderování běží asynchronně (fronta jobů). Entity `FabricationTemplate` a `FabricationJob` mají povinné `tenant_id`; `carrier_ids` v jobu se validují proti tenantovi.

Detail: `docs/reference/fabrication.md` · Implementace: `src/core/fabrication/` · EPIC: `tasks/EPIC-02-FABRICATION/`

## JSONB metadata
JSONB pole (`settings_json`, `metadata_json`, `device_info_json` apod.) slouží pro flexibilní rozšíření bez migrací. Hlavní strukturovaná data jsou vždy v typovaných sloupcích.

## Bezpečnostní architektura
- JWT autentizace na všech endpointech kromě `/r/{public_code}`
- OAuth2/SSO – plánováno (viz `tasks/EPIC-01-AUTH/`)
- "Quishing" ochrana – rate limiting na resolveru, detekce anomálií
- RBAC + ACL model – viz `docs/modules/marketplace/README.md`
