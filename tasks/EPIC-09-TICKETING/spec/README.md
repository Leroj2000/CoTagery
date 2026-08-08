# EPIC-09-TICKETING – Specifikace

## Stav: 🟡 jádro hotové a ověřené (2026-08-08)

## Cíl
Prodej vstupenek na akce + check-in u vchodu přes sdílený Access-Control (ADR-0006).

## Hotovo
- [x] Entity Event / TicketType / Ticket (tenant-scoped, RLS) + migrace InitTicketing
- [x] `POST /ticketing/events`, `.../events/:id/ticket-types`, `.../ticket-types/:id/tickets`
- [x] MVP vydání vstupenky rovnou `paid` (platba = follow-up přes Payment/PSP)
- [x] `TicketEntitlementProvider` (subjectType 'ticket') registrovaný do `AccessRegistry`;
      check-in redeemuje vstupenku (allow → status redeemed; opětovný → deny already_redeemed)
- [x] Ověřeno e2e přes `/access-points/:id/evaluate`

## Follow-up
- [ ] Platba (PaymentSession/PSP) místo přímého `paid`
- [ ] Generování QR/NFC vstupenky (DataCarrier) + sken vstupenky přes resolver
- [ ] TicketHandler (module_type 'ticket') pro zobrazení stavu vstupenky

## Závislosti
- EPIC-15 ACCESS-CONTROL (poskytovatel nároku)
