# Subscription Billing – sdílená schopnost (AS IS/TO BE)

Průřezová schopnost pro **opakované (předplatné) platby**, kterou využívá modul **Membership** (předplatné členství). Není to modul s doménovou logikou – orchestruje předplatné a **deleguje těžkou práci na billing engine PSP**. Zrcadlí stav z PSP a řídí z něj životní cyklus členství.

> Rozlišení: **Payment** modul = jednorázové platby (Scan & Pay). **Billing** = opakované předplatné. Sdílejí `PaymentMethod` (tokenizovaná metoda u PSP).

---

## 1. Princip: delegovat, nestavět znovu
- **Nestavíme** vlastní engine na opakované strhávání, dunning, proraci ani fakturaci → používáme **PSP billing** (Stripe Billing / GoPay recurring / Comgate).
- **My držíme** jen reference (`psp_*_ref`) + zrcadlený stav + auditní log webhooků.
- **Zdroj pravdy o platbě = PSP webhooky** (asynchronní, idempotentní přes `psp_event_ref`). Klientovi se nikdy nevěří.

## 2. Dva nezávislé toky peněz (ADR-0007, PSP = Stripe)
- **Tok 1 – Člen → Tenant (členské předplatné):** **tenant-owns-PSP** přes Stripe Connect. Peníze tečou **přímo tenantovi**; Tagery orchestruje, ale nebere podíl. Entita `TenantBillingConnection`.
- **Tok 2 – Tenant → Tagery (monetizace):** **metered fee podle počtu vydaných karet** (ne % z plateb). Účtováno na Tagery↔tenant SaaS předplatném. Viz §12 Metering.

Detail: `../architecture/decisions/0007-billing-money-flow.md`.

## 3. Entity (money-flow nezávislé jádro)

```
BillingCustomer            # zákazník u PSP pro daného Member
  id, tenant_id, member_id
  psp_customer_ref
  created_at

PaymentMethod              # sdíleno s Payment modulem; tokenizováno, mandate pro recurring
  id, tenant_id, billing_customer_id
  psp_pm_ref, brand, last4, exp_month, exp_year
  is_default

Subscription               # předplatné = spojka Membership ↔ billing
  id, tenant_id
  membership_id, tier_id
  psp_subscription_ref
  status: trialing | active | past_due | canceled | expired | incomplete
  current_period_start, current_period_end
  cancel_at_period_end: bool
  trial_end (nullable)
  created_at, updated_at

Invoice                    # faktura za období
  id, tenant_id, subscription_id
  psp_invoice_ref, invoice_number
  amount_net, vat_rate, vat_amount, amount_gross, currency
  status: draft | open | paid | void | uncollectible
  period_start, period_end
  pdf_url, issued_at, paid_at

BillingWebhookEvent        # append-only, idempotentní zpracování PSP událostí
  id, tenant_id, psp_event_ref (unique), type, payload_json, processed_at

TenantBillingConnection    # Tok 1: připojený PSP účet tenanta (Stripe Connect)
  id, tenant_id
  psp_account_ref, status, capabilities_json
  connected_at

PlatformUsageMeter         # Tok 2: metering pro Tagery↔tenant SaaS billing
  id, tenant_id
  metric: issued_cards      # výhledově i další účtovatelné jednotky
  period_start, period_end
  count
  reported_at               # nahráno do Stripe jako usage record
```

## 4. Životní cyklus a napojení na Membership
1. **Checkout:** vytvoř `BillingCustomer` + `PaymentMethod` (mandate) → `Subscription` (volitelně `trial`). Po `active` → `Membership.status=active`, `valid_to = current_period_end`.
2. **Renewal:** PSP strhne každé období → webhook `invoice.paid` → prodluž `Membership.valid_to`.
3. **Neúspěšná platba:** webhook `payment_failed` → `Subscription.past_due` → **grace period** (konfigurovatelná, např. 7 dní; členství zatím aktivní) → PSP dunning retries → nevymoženo → `canceled` → `Membership.expired` → **Access Control odepře vstup do zón**.
4. **Změna tieru:** proraci řeší PSP; aktualizuj `tier_id` + benefity.
5. **Zrušení:** `cancel_at_period_end` → běží do `valid_to` → `expired`. Okamžité zrušení + refund volitelně.

## 5. Dunning & grace period
Delegováno na retry schedule PSP. Grace period drží přístup během `past_due` (konfigurovatelná per tenant/tier). Napojení na **Access Control**: `expired` = deny.

## 6. Daně / DPH
- CZ **DPH 21 %** default; **reverse charge** pro EU B2B (validace VAT ID).
- Výpočet delegovat na PSP tax (Stripe Tax) kde to jde; faktura musí splnit **CZ legislativu** (řada číslování, údaje dodavatele/odběratele, rozpad DPH).

## 7. Webhooky (zdroj pravdy)
PSP webhook endpoint `POST /api/v1/webhooks/psp` – **ověření podpisu**, idempotence přes `psp_event_ref`. Zrcadlí stav → řídí Membership. Nikdy neměnit stav jen z klienta.

## 8. API kontrakty
```
POST /api/v1/billing/checkout                    – zahájit předplatné → PSP checkout session
GET  /api/v1/billing/subscriptions/:id           – stav předplatného
POST /api/v1/billing/subscriptions/:id/cancel    – { atPeriodEnd: bool }
POST /api/v1/billing/subscriptions/:id/change-tier
GET  /api/v1/billing/invoices                    – faktury (filtr: member, subscription)
GET  /api/v1/billing/portal                      – odkaz na PSP customer portal (self-service)
POST /api/v1/webhooks/psp                         – PSP → Tagery (ověřený podpis)
```
> **Self-service člena:** správu vlastního předplatného a platební metody lze delegovat na **PSP customer portal** (Stripe Billing Portal) – nemusíme stavět vlastní UI.

## 9. RBAC
| Oprávnění | Billing akce |
|---|---|
| `manage` | nastavení billingu, refundy, všechny faktury, konfigurace grace period |
| `edit` | zahájit checkout, změnit tier člena |
| `view` | faktury, stav předplatného |
| `scan_only` | žádný přístup |

Člen (self-service) spravuje **jen své** předplatné/platební metodu přes portal.

## 10. Multi-tenant a bezpečnost
- Všechny entity `tenant_id` (ADR-0001).
- **Nikdy neukládat data karet** (PCI) – jen tokeny/reference u PSP.
- Ověření podpisu webhooků; idempotence.
- Per-tenant PSP účet/připojení dle ADR-0007.

## 11. Doporučená MVP sekvence
1. Jednoduché předplatné (1 tier, karta) přes PSP checkout + webhook → řídí členství
2. Dunning/grace + zrušení + faktury (PDF z PSP)
3. Proraci (změna tieru), DPH/reverse-charge, customer portal

## 12. Metering vydaných karet (Tok 2 – monetizace Tagery)
Tagery vydělává **poplatkem za počet vydaných karet** tenantem, ne procentem z členských plateb (ADR-0007).

- `PlatformUsageMeter` počítá vydané/aktivní `MembershipCard` per tenant za období.
- Metrika se reportuje do Stripe jako **usage record** na Tagery↔tenant SaaS předplatném (metered/tiered pricing – pásma).
- Účtovatelná jednotka (návrh): **aktivní karta v účtovacím období** (definovat přesně – viz ADR-0007 otevřené body).
- Nezávislé na Toku 1: účtuje se i za karty **bez** členského předplatného (členství zdarma).
- Pricing pásma jsou **business rozhodnutí** (TBD), architektura je na ně připravená.
