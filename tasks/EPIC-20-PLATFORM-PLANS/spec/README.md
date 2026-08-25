# EPIC-20-PLATFORM-PLANS – SaaS plány firem, entitlementy a limity

## Stav: ⬜ NÁVRH (design v [ADR-0009](../../../docs/architecture/decisions/0009-platform-plans-entitlements.md), stav *Návrh*) · čeká na odsouhlasení rozsahu + čísel limitů

Řídí se **ADR-0009** (autoritativní *jak*). Tento spec je *co postavit*.

## Cíl
Podle **SaaS plánu firmy** (tenant vůči Tagery) zapínat/vypínat **moduly** a **limitovat
počty** zdrojů (položky/assets, identifikátory/QR, uživatelé, inzeráty půjčovny…). Aby
firma sama neobešla to, co platí, a aby „plán" byl jeden definovaný pojem, ne ručně
skládané DB řádky.

## Co už je hotové (na čem se staví)
- **Zapínání/vypínání modulů per firma** – tabulka `organization_modules` (`state`
  active/inactive, opt-out) + vynucení v authz guardu (`AuthzService.authorize`), EPIC-18
  Fáze 3. Sloupec `limits_json` existuje, ale **nevynucuje se**.
- **Platform-admin vrstva** (ADR-0009 open Q#2, hotovo `ef3c4c1`): flag
  `users.is_platform_admin` + `PlatformAdminGuard` + sekce `/platform` (přehled/zakládání
  firem). **Přiřazení plánu patří sem.**

## Rozsah (hybrid: config katalog řídí DB `organization_modules`)
1. **Katalog plánů v kódu** (`PlanKey`/`ModuleKey`/`LimitKey`, typově bezpečné) – Free /
   Pro / Business + čísla limitů. *Konkrétní úrovně a čísla = produktové rozhodnutí.*
2. **`tenants.plan_key`** (+ status) a **`PlanService.applyPlan()`** = transakční projekce
   config → `organization_modules` (state per modul) + invalidace authz cache + audit.
3. **`EntitlementsService.assertWithinLimit()`** – vynucení limitů (`402 plan_limit_reached`)
   na místech vzniku: `asset.create`, `carriers/batch`, publikace rental listingu, invite
   uživatele.
4. **Přidat `asset`** (příp. `inventory`/`marketplace`) do `CONTROLLED_MODULES` + backfill
   `organization_modules`, ať se stávajícím firmám nic nezablokuje.
5. **Přiřazení plánu jen přes platform-admin** (`/platform`); OWNER smí přepínat jen moduly
   v rámci plánu (guard validuje proti plánu) → zavírá self-grant.
6. **Grandfathering při downgradu** – nemaže data, blokuje jen vznik nových nad limit.
7. **UI:** platform-admin obrazovka pro přiřazení plánu firmě + tenant hláška „limit/upgrade".

## Fázování
- **F1 – Katalog + přiřazení:** katalog plánů, `tenants.plan_key`, `applyPlan` (projekce do
  `organization_modules`), platform-admin UI „přiřadit plán". E2e: apply → moduly firmy
  odpovídají plánu.
- **F2 – Vynucení limitů:** `EntitlementsService` + quota-checky na 4 místech vzniku;
  `asset` do řízených modulů + backfill. E2e: limit dosažen → 402; modul mimo plán → 403.
- **F3 – UX + downgrade:** tenant hláška o limitu/upgrade; grandfathering při downgradu.
- **F4 – Billing:** napojení na PSP/Stripe (platba → `applyPlan`, self-service upgrade) –
  navazuje na EPIC-17 / ADR-0007 (dnes přiřazuje plán platform-admin ručně).

## Otevřené otázky (z ADR-0009, dořešit před/při stavbě)
1. Konkrétní katalog: kolik úrovní a čísla limitů.
2. Kde držet **override** limitů: `organization_modules.limits_json` (per modul) vs.
   `tenants.entitlement_overrides` (tenant-wide, preferováno pro cross-modul limity).
3. Napojení na Billing/Stripe (kdy plán navázat na reálné předplatné + webhooky).

## Závislosti
- **ADR-0009** (design), platform-admin vrstva (přiřazení plánu), EPIC-18 authz
  (`organization_modules` + guard), EPIC-17 BILLING + ADR-0007 (F4 platba).

## Definition of Done
Viz `tasks/ROADMAP.md` §DoD. Navíc: **izolační test** – firma nepřekročí limit ani
nezapne modul mimo plán; downgrade nemaže data.
