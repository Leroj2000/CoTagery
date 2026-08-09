# API kontrakty – Core (v1)

> Zdroj pravdy pro tvar REST API jádra. Backend i frontend na tom závisí. Konvence dle ADR-0003.
> Base URL: `/api/v1` · Auth: `Authorization: Bearer <access_token>` (kromě resolveru).

---

## Průřezové konvence

### Autentizace
Všechny endpointy vyžadují platný JWT access token, kromě `GET /r/{public_code}`. `tenant_id` se bere z tokenu (ADR-0001), nikdy z parametrů.

### Formát chyb (jednotný)
```json
{
  "error": {
    "code": "OBJECT_NOT_FOUND",
    "message": "Human-readable popis",
    "details": [{ "field": "name", "issue": "required" }],
    "traceId": "01J..."
  }
}
```
| HTTP | Kdy |
|---|---|
| 400 | Validace vstupu |
| 401 | Chybí/neplatný token |
| 403 | Nedostatečné oprávnění (RBAC/ACL) |
| 404 | Zdroj neexistuje **nebo** patří jinému tenantovi (nerozlišujeme – neúnik informace) |
| 409 | Konflikt (duplicita, stavový přechod) |
| 422 | Sémanticky neplatný požadavek |
| 429 | Rate limit |

### Stránkování (cursor-based)
```
GET /api/v1/objects?limit=50&cursor=<opaque>
→ { "data": [...], "page": { "nextCursor": "...", "hasMore": true } }
```
Default `limit=25`, max `100`.

### Filtrování a řazení
`?filter[module_type]=product&filter[status]=active&sort=-created_at`

### Idempotence (mutace)
`POST` s hlavičkou `Idempotency-Key: <uuid>` → opakování vrátí původní výsledek (48h okno).

### Rate limiting
Hlavičky `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`. Resolver má vlastní přísnější limit (ADR-0002).

---

## Auth

```
POST /api/v1/auth/login          { email, password } → { accessToken, refreshToken, expiresIn }
POST /api/v1/auth/refresh        { refreshToken }     → { accessToken, refreshToken, expiresIn }
POST /api/v1/auth/logout         { refreshToken }     → 204
GET  /api/v1/auth/me                                  → { user, tenant, tenantRole }
```
Detail: `tasks/EPIC-01-AUTH/`.

---

## DigitalObjects

```
GET    /api/v1/objects                 → list (filtr: module_type, status, location_id)
POST   /api/v1/objects                 → create
GET    /api/v1/objects/{id}            → detail (+ carriers, + počty scanů)
PATCH  /api/v1/objects/{id}            → partial update
DELETE /api/v1/objects/{id}            → soft delete (archivace)
```

**Create request:**
```json
{
  "moduleType": "product",
  "slug": "eco-bottle-500",
  "primaryUrl": "https://...",
  "validFrom": "2026-08-01T00:00:00Z",
  "validTo": null,
  "metadata": { }
}
```
**Object (response):** `id, tenantId, moduleType, slug, status, primaryUrl, metadata, validFrom, validTo, createdAt, updatedAt`.

Vyžaduje ACL `edit`+ na create/update, `view` na čtení (viz `docs/modules/marketplace/README.md`).

---

## DataCarriers

```
GET    /api/v1/objects/{id}/carriers        → nosiče objektu
POST   /api/v1/objects/{id}/carriers        → přidat nosič (qr | nfc | hybrid)
GET    /api/v1/carriers/{id}/qr?format=svg  → vygenerovaný QR (svg|png), pro tisk
POST   /api/v1/carriers/{id}/nfc/pair       → spárovat NFC ({ nfcUid, nfcPayload })

# Předgenerovaný pool (pre-printed) + claim:
POST   /api/v1/carriers/batch               → { count, carrierType? } → N nepřiřazených kódů
GET    /api/v1/carriers/unassigned          → nepřiřazené nosiče v poolu
POST   /api/v1/carriers/claim               → { publicCode, objectId } → přiřadit kód k objektu
```
> Sken nepřiřazeného kódu přes resolver vrací `{status:'unassigned'}` (výzva k aktivaci); po claim se resolve na objekt.
`public_code` generuje server (ADR-0003), klient ho neposílá. Export do výrobních souborů → `docs/reference/fabrication.md`.

---

## ScanEvents / Analytics

```
GET /api/v1/objects/{id}/scans     → log (filtr: from, to, event_type, carrier_type)
GET /api/v1/analytics/overview     → { totalObjects, scansByModule, recentActivity, topObjects }
GET /api/v1/analytics/timeseries   → ?metric=scans&interval=day&from=&to=
```
Data jsou eventually consistent (ADR-0002).

---

## Resolver (veřejný, bez auth)

```
GET /r/{public_code}
  Accept: text/html  → HTML stránka modulu
  Accept: application/json → { object, module, action }
```
Chování: lookup → validace platnosti → modulový `handleScan` → async `ScanEvent`. Rate-limited.

---

## ObjectPermissions (RBAC/ACL)

```
GET    /api/v1/objects/{id}/permissions        → seznam ACL
POST   /api/v1/objects/{id}/permissions        → udělit ({ subjectType, subjectId, permission, expiresAt? })
DELETE /api/v1/permissions/{id}                → odebrat
```
Jen `owner`/`manage` na objektu (nebo OWNER/ADMIN tenantu).

---

## Team & Tenant

```
GET   /api/v1/users                → uživatelé tenantu
POST  /api/v1/users/invite         → pozvat ({ email, tenantRole })
PATCH /api/v1/users/{id}           → změna role/statusu
GET   /api/v1/tenant               → nastavení tenantu
PATCH /api/v1/tenant               → branding, settings
GET   /api/v1/locations            → lokace
POST  /api/v1/locations            → přidat lokaci
```

> Modulově specifické endpointy (Ticketing, Rental, Gallery…) žijí v příslušných `docs/modules/*` a jejich EPIC specifikacích.
