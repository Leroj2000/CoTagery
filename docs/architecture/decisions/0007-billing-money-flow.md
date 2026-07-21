# ADR-0007 – Money flow předplatného a monetizace platformy

- **Stav:** Přijato (pricing pásma TBD)
- **Datum:** 2026-07-21

## Kontext
Membership zavádí předplatné (`docs/reference/billing.md`). Dvě oddělené otázky:
1. **Kdo vybírá peníze od členů** za jejich členské předplatné?
2. **Jak vydělává Tagery** (monetizace platformy)?

## Rozhodnutí

### Dva nezávislé toky peněz
- **Tok 1 – Člen → Tenant (členské předplatné):** **tenant-owns-PSP** přes **Stripe Connect**. Peníze tečou přímo tenantovi; Tagery orchestruje předplatné přes připojený účet, ale **nebere z členských plateb žádný podíl**. Minimální legal/PCI/MoR zátěž.
- **Tok 2 – Tenant → Tagery (platform fee):** **usage-based (metered) poplatek podle počtu vydaných karet** tenantem, ne procento z plateb. Účtováno na Tagery↔tenant SaaS předplatném (Stripe metered/tiered).

### Proč per-card metering místo application fee
- Tagery se **nedotýká toku peněz členů** → odpadá MoR/PSD2/money-transmitter.
- Funguje i pro **karty bez předplatného** (členství zdarma) – Tagery účtuje za *vydání karty*, ne za platbu.
- Čistý SaaS billing podle spotřeby.

### PSP
**Stripe** jako primární (Connect + Billing + Tax + customer portal, nejsilnější recurring). Billing navrhnout přes **adaptor**, aby šel PSP později doplnit/změnit.

## Metering vydaných karet
- Nová schopnost: **počítadlo vydaných/aktivních `MembershipCard` per tenant** (a výhledově i dalších účtovatelných jednotek).
- Metrika se reportuje do Stripe jako usage record na Tagery↔tenant subscription.
- Rozlišit „vydaná" vs. „aktivní" karta (definovat, co je účtovatelná jednotka – návrh: aktivní karta v účtovacím období).

## Důsledky
- Entita **`TenantBillingConnection`** (Tok 1: `psp_account_ref` tenanta, capabilities).
- Entita/mechanismus **`PlatformUsageMeter`** (Tok 2: tenant, metrika `issued_cards`, období, count).
- Tagery↔tenant SaaS billing (dosud Fáze 3) má tímto definovaný model – využívá stejnou Billing schopnost, jen v roli bilelra je Tagery.
- Webhooky rozlišují kontext (členská platba na účtu tenanta vs. Tagery SaaS platba).

## Otevřené (business pricing, neblokuje architekturu)
1. Konkrétní **pásma a ceny** per karta (free tier? od kolika karet? cena/karta?).
2. Účtovatelná jednotka: „vydaná" vs. „aktivní" karta v období.
3. Ponechat i variantu application fee jako alternativu pro některé tenanty?
