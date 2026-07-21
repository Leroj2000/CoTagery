# Tagery – Směrovač úkolů (Vrstva 1)

## Jak používat tento soubor
Před každým úkolem určete kategorii a aktivujte odpovídající modul/fázi.

## Směrovací tabulka

| Typ požadavku | Aktivuj | Soubor |
|---|---|---|
| Návrh DB schématu | Stage 01 | `stages/01_schema_design/CONTEXT.md` |
| API endpoint | Stage 02 | `stages/02_api_development/CONTEXT.md` |
| UI komponenta | Stage 03 | `stages/03_frontend_components/CONTEXT.md` |
| Testování / bezpečnost | Stage 04 | `stages/04_testing_qa/CONTEXT.md` |
| Core architektura (Tenant, DigitalObject, DataCarrier, ScanEvent, Resolver) | Core | `docs/architecture/README.md` |
| QR/NFC správa, API kontrakty | Core ref | `docs/reference/README.md` |
| Export tiskových/gravírovacích/3D souborů | Fabrication | `docs/reference/fabrication.md` · `tasks/EPIC-02-FABRICATION/spec/README.md` |
| Product / Loyalty / Payment / Inventory / Trace / Membership | Retail | `docs/modules/retail/README.md` |
| Řízení vstupu (členské zóny, check-in) | Access Control | `docs/reference/access-control.md` |
| Předplatné, recurring platby, faktury, PSP | Billing | `docs/reference/billing.md` · `tasks/EPIC-17-BILLING/spec/README.md` |
| Ticketing / Shared Gallery | Events | `docs/modules/events/README.md` |
| Automation / IoT scény | IoT | `docs/modules/iot/README.md` |
| Rental / Contact / Time Tracking / RBAC + ACL | Marketplace | `docs/modules/marketplace/README.md` |
| Auth, JWT, OAuth2, SSO | EPIC-01 | `tasks/EPIC-01-AUTH/spec/README.md` |
| Výroba QR/NFC (štítky, gravírky, 3D) | EPIC-02 | `tasks/EPIC-02-FABRICATION/spec/README.md` |
| Nový EPIC / feature | Tasks | `tasks/` |

## Multi-tenant – vždy zkontroluj
`_config/shared/tenancy_rules.md` → před každým DB dotazem nebo API endpointem

## MVP priorita (implementovat první)
1. Core: Tenant, User, Location, DigitalObject, DataCarrier, ScanEvent, Resolver
2. RBAC: ObjectPermission + enforcement
3. Moduly: Product → Ticketing → Rental → Gallery → Time Tracking → Automation → Contact
4. Auth: JWT → OAuth2

## Aktuální fáze projektu
- Fáze: **Inicializace / Plánování**
- Aktivní EPIC: EPIC-01-AUTH (plánováno)
- Viz: `PICKUP.md`
