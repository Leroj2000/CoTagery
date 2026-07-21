# Stage 01 – Schema Design (Vrstva 2)

## Vstupy
- Požadavky z `tasks/` (příslušný EPIC/TASK)
- Globální architektura z `docs/architecture/`
- Tenancy pravidla z `_config/shared/tenancy_rules.md`

## Výstupy
- SQL migrace soubory
- Aktualizace `docs/architecture/README.md`

## Checklist
- [ ] Každá tabulka má `tenant_id` (NOT NULL, indexováno)
- [ ] JSONB metadata pole pro flexibilní rozšíření
- [ ] Index strategie definována
- [ ] Migrace je reverzibilní (DOWN skript)

## Konvence
- Tabulky: `snake_case`, prefix dle modulu
- Primární klíče: UUID
- Timestamps: `created_at`, `updated_at` (automatické)
