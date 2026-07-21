# Stage 04 – Testing & QA (Vrstva 2)

## Vstupy
- Implementace z Stage 02 a 03
- Tenancy pravidla z `_config/shared/tenancy_rules.md`

## Výstupy
- Test soubory (unit, integration, e2e)
- QA report

## Checklist
- [ ] Cross-tenant izolace otestována (tenant A nesmí vidět data tenant B)
- [ ] Auth tokeny – expiry, refresh, revokace
- [ ] API rate limiting ověřen
- [ ] SQL injection prevention ověřena
- [ ] Mobile responsivita otestována (375px, 768px, 1280px)

## Testovací strategie
- Unit testy: Jest (business logika, utility)
- Integration testy: Supertest (API endpointy s reálnou DB)
- E2E testy: Playwright (kritické user flows)
