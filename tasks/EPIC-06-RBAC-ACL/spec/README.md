# EPIC-06-RBAC-ACL – Specifikace

## Stav: 🟡 jádro hotové a ověřené (2026-08-09)

## Cíl
Per-objektová oprávnění (ACL) nad globálními rolemi (PRD §7).

## Hotovo
- [x] Entita `ObjectPermission` (RLS) + migrace InitRbac
- [x] `AclService.check()`: OWNER/ADMIN implicitně vše; jinak dle ObjectPermission (user + tenant-wide, s expirací), hierarchie owner>manage>edit>view>scan_only
- [x] `GET/POST /objects/:id/permissions`, `DELETE /permissions/:id`, `GET /objects/:id/access-check`
- [x] Ověřeno e2e: OWNER=vše; VIEWER edit false → grant → true → revoke → false; manage stále false

## Follow-up
- [ ] Wiring `assert(edit/manage)` do mutačních endpointů (Objects/Carriers/…) jako guard
- [ ] Skupinová oprávnění (group membership rozklad)

## Závislosti
- EPIC-03 CORE-DOMAIN, EPIC-04 DIGITAL-OBJECT
