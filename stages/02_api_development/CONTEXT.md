# Stage 02 – API Development (Vrstva 2)

## Vstupy
- Schéma z Stage 01
- API kontrakty z `docs/reference/`
- Zadání z `tasks/`

## Výstupy
- NestJS controllers, services, DTOs
- Aktualizace `docs/reference/README.md`

## Checklist
- [ ] Každý endpoint ověřuje `tenant_id` z JWT
- [ ] DTO validace (class-validator)
- [ ] Swagger dokumentace
- [ ] Error handling (standardní formát)
- [ ] Rate limiting na veřejných endpointech

## Konvence
- REST: `kebab-case` URL, množné číslo pro kolekce
- GraphQL: camelCase field names
- Verze: `/api/v1/...`
