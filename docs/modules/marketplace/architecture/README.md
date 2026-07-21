# Marketplace / Rental – Architektura modulu

## Platform-shared entity (výjimka z tenant izolace)
Rental reputace funguje jako Uber/Bolt – přenositelná napříč tenanty (ADR-0005). Proto:

- `RenterProfile`, `IdentityVerification` (výsledek), `RentalReview` (agregát) jsou **platform-scoped** (bez `tenant_id`, mimo tenant RLS).
- Přístup jen přes dedikovaný **RenterReputationService** s vlastní autorizací – ne přes běžný tenant kontext.
- `Loan`, `Item`, `ConditionReport` zůstávají **tenant-scoped** (běžná RLS dle ADR-0001).

```
[tenant-scoped]                       [platform-shared]
Item ──< Loan >───────────────────────> RenterProfile
           │                                  │
           └─ ConditionReport                 ├─ IdentityVerification
           └─ RentalReview (píše se ─────────>┤   (rolling rating_avg)
              v tenant kontextu,              └─ consent
              agreguje na profil)
```

## Vztahy
- `Loan.renter_profile_id` → cross-boundary odkaz na platformový profil (ne FK přes RLS, řešeno service vrstvou).
- Review napsané u tenanta A se propíše do platformového skóre, které vidí i tenant B.

## Integrační body
- **KYC provider** (post-MVP) – `full_kyc`, ukládáme jen výsledek + referenci.
- **PSP** – kauce a platby půjček (delegováno, netokáme karty).
- **Bezpečnostní review (Stage 04)** povinné kvůli difamaci a cross-tenant úniku PII.
