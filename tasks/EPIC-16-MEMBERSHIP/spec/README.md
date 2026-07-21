# EPIC-16-MEMBERSHIP – Specifikace

## Cíl
Modul klubového/nákupního členství: členské karty (QR/NFC), **úrovně (tiery)** a **platnost (předplatné)**, nároky (benefity) – vstup do zón, slevy, služby zdarma / za speciální cenu. Navržen jako **tenká entitlement vrstva**, která deleguje realizaci benefitů.

Referenční dokumentace: `docs/modules/retail/README.md` (§5.12).

## Scope

### In scope
- Entity: `Member` (per-tenant identita), `MembershipTier`, `Membership` (platnost, status, auto_renew), `MembershipCard` (→ DataCarrier), `MembershipBenefit`
- Tiery s odlišnými benefity + platnost/expirace členství
- Vydání karty (QR/NFC) a její spárování s členstvím
- **Napojení na Access Control** (EPIC-15) – vstup do `access_zones` tieru (Membership jako entitlement provider)
- **Napojení na Payment** – aplikace `MembershipBenefit` (sleva / speciální cena / zdarma) při účtování
- **Sdílená identita s Loyalty** (`Member` ≈ `Customer`)
- Self-service zobrazení karty, platnosti, benefitů

### Out of scope
- Recurring billing engine – řeší samostatný **EPIC-17-BILLING** (`docs/reference/billing.md`); Membership jen konzumuje `Subscription` stav
- Sjednocení identit do `Party`/`Person` (backlog poznámka)

## Acceptance kritéria
- [ ] Lze definovat tiery s různými benefity a platností
- [ ] Členství má platnost od/do a stav (active/expired/suspended/cancelled)
- [ ] Karta (QR/NFC) se vydá a spáruje s členstvím
- [ ] Sken karty u brány → Access Control ověří aktivní členství + tier pro zónu
- [ ] Sken u pokladny → Payment aplikuje benefit tieru
- [ ] Expirované/suspendované členství nepustí do zóny ani nedá slevu
- [ ] Vše tenant-scoped (izolační test)

## Závislosti
- EPIC-15 ACCESS-CONTROL (vstup do zón)
- EPIC-17 BILLING (předplatné) – řídí platnost/status členství
- EPIC-03 CORE-DOMAIN; Payment a Loyalty (benefity, identita) – stub, pokud ještě nejsou

## Podúkoly (návrh)
- [ ] TASK-01-MEMBER-TIER – Member, MembershipTier, Membership + platnost
- [ ] TASK-02-CARD – MembershipCard ↔ DataCarrier, vydání QR/NFC
- [ ] TASK-03-BENEFITS – MembershipBenefit + napojení na Payment
- [ ] TASK-04-ZONE-ACCESS – Membership jako entitlement provider pro Access Control
