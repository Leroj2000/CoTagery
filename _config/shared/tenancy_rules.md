# Pravidla multi-tenancy izolace (Vrstva 3 – NEMĚNNÉ)

## KRITICKÁ PRAVIDLA – NIKDY NEPORUŠOVAT

### 1. Povinný tenant_id v každém SQL dotazu
Každý dotaz na databázi MUSÍ obsahovat filtr `WHERE tenant_id = :tenantId`.

```sql
-- SPRÁVNĚ
SELECT * FROM objects WHERE tenant_id = $1 AND id = $2;

-- ŠPATNĚ – chybí tenant_id!
SELECT * FROM objects WHERE id = $1;
```

### 2. Tenant ID z JWT, nikdy z URL/body
`tenant_id` se vždy extrahuje z ověřeného JWT tokenu, nikoliv z request parametrů.

```typescript
// SPRÁVNĚ
const tenantId = req.user.tenantId; // z JWT guardu

// ŠPATNĚ
const tenantId = req.params.tenantId; // manipulovatelné uživatelem
```

### 3. Row Level Security (RLS)
Všechny tabulky mají PostgreSQL RLS policy jako pojistka na úrovni DB.

### 4. Cross-tenant operace jsou zakázány
Žádná service nesmí přistupovat k datům jiného tenanta, ani při admin operacích (použij audit log).

### 5. Logy nesmí obsahovat data jiných tenantů
Log entries vždy označeny `tenant_id`, nikdy nesmí obsahovat PII jiného tenanta.

## Ověření při code review
- [ ] Všechny TypeORM queries mají `where: { tenantId }` nebo equivalent
- [ ] Žádný endpoint nepřijímá `tenant_id` z uživatelského vstupu
- [ ] Nové tabulky mají `tenant_id NOT NULL` a index
