# EPIC-10-RENTAL – Specifikace

## Stav: 🟡 jádro hotové a ověřené (2026-08-08)

## Cíl
Půjčování věcí + stupňovité ověření nájemce + oboustranné hodnocení s **platformově
sdílenou reputací** (Uber/Bolt model, ADR-0005).

## Hotovo
- [x] `RenterProfile` = **platformová** entita (bez tenant_id, bez RLS) – reputace/ověření sdílené napříč tenanty
- [x] `Item` / `Loan` / `RentalReview` tenant-scoped (RLS) + migrace InitRental
- [x] Ověření nájemce (stupňovité: none/contact/document/full_kyc); půjčka vyžaduje ≥ `requiredVerificationLevel`
- [x] Hodnocení `lessor_to_renter` → rolling average na platformovém profilu
- [x] Ověřeno e2e: verification gate (400), sdílená reputace (B vidí 5.00 od A), cross-tenant update (4.00/2), izolace půjček (404)

## Follow-up
- [] Reálné OTP / KYC (teď `verify` jen nastaví úroveň); consent se sdílenou reputací
- [ ] Double-blind reveal hodnocení, ConditionReport (fotky výdej/vrácení), kauce přes Payment
- [ ] Napojení na DataCarrier (QR na věci) + resolver handleScan

## Závislosti
- EPIC-03 CORE-DOMAIN; ADR-0005 (platform-shared reputace)
