# EPIC-17-BILLING – Specifikace

## Cíl
Sdílená schopnost **opakovaných (předplatných) plateb**, kterou využívá Membership. Orchestruje předplatné a **deleguje dunning/proraci/fakturaci/daně na billing engine PSP**; zdroj pravdy o platbě = PSP webhooky.

Referenční dokumentace: `docs/reference/billing.md`. Money flow: ADR-0007.

## Scope

### In scope
- Entity: `BillingCustomer`, `PaymentMethod` (sdíleno s Payment), `Subscription`, `Invoice`, `BillingWebhookEvent`
- Checkout → PSP session; vytvoření předplatného (volitelně trial)
- **Webhook endpoint** s ověřením podpisu + idempotencí → zrcadlení stavu
- Řízení životního cyklu členství: renewal prodlužuje `valid_to`, failed → past_due → grace → expired
- Dunning/grace (grace konfigurovatelná per tenant/tier)
- Zrušení (at period end / okamžité), změna tieru (proraci přes PSP)
- Faktury (PDF z PSP), DPH 21 % + reverse charge EU B2B
- Self-service přes PSP customer portal
- **Tok 1** (člen→tenant): `TenantBillingConnection` – připojení Stripe Connect účtu tenanta
- **Tok 2** (tenant→Tagery): `PlatformUsageMeter` – metering vydaných karet + report do Stripe (usage-based SaaS fee)

### Out of scope
- Vlastní recurring/dunning engine (děláme přes PSP)
- Platformové billing tenantů (Tagery ↔ tenant za SaaS) – to je Fáze 3, jiná věc
- Účetní/ERP integrace (později)

## Acceptance kritéria
- [ ] Checkout založí předplatné a po úspěchu aktivuje členství (`valid_to` = konec období)
- [ ] `invoice.paid` webhook prodlouží členství; `payment_failed` spustí grace → po dunning expiraci členství
- [ ] Expirované členství → Access Control odepře vstup do zón
- [ ] Webhooky idempotentní (duplicitní `psp_event_ref` nezmění stav dvakrát) a s ověřeným podpisem
- [ ] Žádná data karet u nás (jen tokeny/reference) – PCI
- [ ] Faktura obsahuje rozpad DPH a splňuje CZ náležitosti
- [ ] Vše tenant-scoped; webhook správně přiřazen tenantovi/účtu

## Závislosti
- EPIC-03 CORE-DOMAIN; Membership (`EPIC-16`) jako konzument
- **Stripe** účet (ADR-0007: tenant-owns-PSP přes Connect; PSP = Stripe)
- Payment modul (sdílený `PaymentMethod`)

> Pricing pásma per-card fee jsou business TBD (ADR-0007), **neblokují** implementaci – metering je připravený, ceník se dokonfiguruje.

## Podúkoly (návrh)
- [ ] TASK-01-PSP-CONNECT – TenantBillingConnection, Stripe Connect onboarding tenanta
- [ ] TASK-02-SUBSCRIPTION – checkout, Subscription, trial, napojení na Membership
- [ ] TASK-03-WEBHOOKS – webhook endpoint, idempotence, zrcadlení stavu, grace/dunning
- [ ] TASK-04-INVOICES-TAX – faktury, DPH/reverse-charge, customer portal
- [ ] TASK-05-USAGE-METERING – PlatformUsageMeter (počet vydaných karet) + report do Stripe (Tok 2)
