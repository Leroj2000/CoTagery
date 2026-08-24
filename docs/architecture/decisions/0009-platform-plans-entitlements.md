# ADR-0009 – Platform plány, entitlementy a limity (plan-driven gating modulů)

- **Stav:** Návrh
- **Datum:** 2026-08-24

## Kontext
Chceme podle **SaaS plánu firmy** (tenant vůči Tagery) řídit, které **moduly** má
zapnuté, a **limitovat počty** zdrojů (položky/assets, identifikátory/QR, uživatelé,
inzeráty půjčovny…). Dnešní stav:

- **Zapínání/vypínání modulů per firma UŽ existuje a je vynucené** (EPIC-18 Fáze 3):
  tabulka `organization_modules` (`state` active/inactive, opt-out model) + authz guard
  (`AuthzService.authorize`) bere prefix oprávnění (`rental.*`, `product.*`…) a když je
  modul pro org `inactive`, vrátí 403. Čte se přes SECURITY DEFINER `org_inactive_modules`
  v guard fázi (bez tenant kontextu). Řízené moduly: `product, membership, ticketing,
  gallery, rental, billing, access`.
- **`organization_modules.limits_json`** (volný `jsonb`) existuje, ale **nikde se
  nevynucuje**.
- **`asset`, `inventory`, `marketplace`, `found`** nejsou mezi `CONTROLLED_MODULES` →
  položky se dnes gate-ovat nedají.
- **Chybí pojem „plán".** Moduly se přepínají ručně, řádek po řádku.
- **Pozor na vrstvu:** stávající `Subscription`/`tier` (EPIC-17, ADR-0007) je předplatné
  **klubového členství koncových zákazníků firmy**, ne SaaS plán firmy. Na plán firmy je
  to špatná vrstva.
- **Bezpečnostní díra:** `/modules` PATCH drží tenant-level oprávnění
  `core.module.configure` (má ho OWNER firmy) → při čistě ručním DB přepínání si firma
  modul **zapne sama**, bez vazby na to, co platí.

Zvažovány dva čisté přístupy a jejich rizika (viz „Alternativy"). Ani jeden sám nestačí.

## Rozhodnutí
**Hybrid: kanonická definice plánů v kódu (config) řídí efektivní stav v DB
(`organization_modules` + ukazatel na tenantovi), s možností per-tenant override.**
Není to „config _místo_ DB" — vynucení modulů musí číst z DB (guard fáze), takže DB
zůstává zdrojem pravdy o **efektivním** stavu; config je zdroj pravdy o tom, **co plán
znamená**.

### Vrstvy
| Vrstva | Kde | Zdroj pravdy pro |
|---|---|---|
| **Katalog plánů** | kód (`plans.catalog.ts`), typově bezpečné | *definici* plánu (moduly + limity + cena) |
| **Přiřazení plánu firmě** | `tenants.plan_key` (+ status/platnost) | *který* plán firma má |
| **Efektivní stav modulů** | `organization_modules.state` | co čte authz enforcement |
| **Per-tenant override limitů** | `organization_modules.limits_json` / `tenants.entitlement_overrides` | bespoke výjimky nad plánem |

### Katalog plánů (config)
```ts
type PlanKey = 'free' | 'pro' | 'business';
interface PlanDef {
  key: PlanKey;
  name: string;
  modules: ModuleKey[];                 // které moduly plán zapíná
  limits: Partial<Record<LimitKey, number>>; // číslo = strop; chybí/null = neomezeno
}
// LimitKey: 'assets' | 'carriers' | 'users' | 'listings' | 'locations' | ...
export const PLANS: Record<PlanKey, PlanDef> = { /* … */ };
```
Konkrétní čísla limitů = samostatné rozhodnutí (viz Otevřené otázky), ne součást tohoto ADR.

### Aplikace plánu (config → DB), transakčně
`PlanService.applyPlan(tenant, planKey)`:
1. nastaví `tenants.plan_key`,
2. **projekce**: pro každý řízený modul zapíše `organization_modules.state` =
   `active` když `module ∈ plan.modules`, jinak `inactive`,
3. invaliduje authz module cache (`AuthzService.invalidateModules`),
4. zapíše audit (`plan.assigned`).
Vše v jedné transakci → žádný částečně aplikovaný stav (řeší riziko „no atomic apply").

### Vynucení limitů — `EntitlementsService`
- `resolve(tenantId)` = limity z `PLANS[plan_key]` **⊕ per-tenant override** (override má
  přednost).
- `assertWithinLimit(limitKey, currentCount)` → při dosažení stropu vyhodí
  **`402 Payment Required`** (strojově čitelný `reasonCode: 'plan_limit_reached'` +
  `limitKey`, `limit`, `used`), s CTA na upgrade.
- **Místa vynucení (creation points):**
  `asset.create`, `carriers/batch` (generování QR/NFC poolu), rental listing publikace,
  user invite. (Rozšiřitelné.)
- Počítá se pod tenant RLS (`SELECT count(*)`), takže limit je vždy per firma.

### Hranice platform-admina (uzavření self-grant díry)
- **Přiřazení plánu** (`plan_key`) smí měnit jen **platform-admin** (Tagery), ne tenant.
  Zavádí se odděleně od tenant RBAC (viz Otevřené otázky – konkrétní mechanismus).
- Tenant OWNER přes `core.module.configure` smí modul přepnout **jen v rámci plánu**:
  zapnout lze pouze modul `∈ plan.modules` (guard validuje proti plánu), vypnout smí
  cokoli. → Nelze si zapnout, co není v plánu.

### Chování při downgradu
Downgrade, který dostane firmu nad limit, **nemaže data**. Existující zdroje se
„grandfatherují"; blokuje se jen **vznik nových**, dokud firma neklesne pod strop (nebo
neupgraduje). Modul mimo nový plán se přepne na `inactive` (data zůstávají, jen skrytá/RO).

## Alternativy (a proč ne)
- **Jen ruční DB přepínání (bez katalogu):** rizika — self-grant/únik tržeb, drift
  (plán nikde nedefinovaný), žádná atomická změna, změna plánu se nepropaguje, volný
  `jsonb` bez typů (překlepy tiše vypnou limit), mimo git/review/rollback, vynucení se
  snadno vynechá, provozní zátěž roste s počtem firem.
- **Jen config (bez DB):** enforcement modulů stejně čte z DB (guard fáze), takže by se
  DB stejně plnila; navíc bespoke výjimky (`Pro + extra 200 položek`) čistý config
  nevyjádří → override vrstva je nutná tak jako tak. Změna plánu = deploy (přijatelné,
  plány se mění zřídka).
- **Rozšířit billing `Subscription` na platform úroveň:** silná vazba na PSP webhooky pro
  něco, co teď řešíme manuálně; míchá s klubovými členstvími. Odloženo (viz níže).

## Důsledky
- **Maximální reuse:** enforcement modulů (authz guard) i tabulka `organization_modules`
  se nemění koncepčně — plán je jen plní. Přidává se katalog, ukazatel na tenantovi,
  `applyPlan`, `EntitlementsService` a ~4 quota-checky.
- **Rozšíření `CONTROLLED_MODULES`** o `asset` (a dle potřeby `inventory`/`marketplace`),
  aby šly položky gate-ovat. Pozor: přidání modulu do řízených znamená, že u firem bez
  příslušného plánu se zablokují jeho write endpointy — plány musí `asset` obsahovat všude,
  kde ho firmy potřebují (migrace/backfill `organization_modules` při zavedení).
- **Typová bezpečnost:** `PlanKey`/`ModuleKey`/`LimitKey` jsou enum-y v kódu; překlep
  neprojde kompilací (řeší riziko volného `jsonb`).
- **Verzování & audit:** definice plánu je v gitu (review, rollback, historie);
  přiřazení a změny se logují do audit logu.
- **Zachovává ADR-0001** (počítání i zápisy pod RLS), **ADR-0004** (monolit, žádná nová
  služba) a **ADR-0007** (billing money-flow zůstává pro klubová členství).
- **Bez PSP zpočátku:** plán přiřazuje platform-admin ručně; self-service upgrade +
  platba (Stripe) je následný krok (navazuje na EPIC-19 F4 / ADR-0007).

## Otevřené otázky (neblokují návrh, řeší se při implementaci)
1. **Konkrétní katalog:** kolik úrovní (Free/Pro/Business?) a čísla limitů — samostatné
   produktové rozhodnutí.
2. **Mechanismus platform-admina:** globální super-admin flag na uživateli vs. dedikovaná
   „platform org" vs. out-of-band (CLI/seed). Musí být mimo tenant RBAC.
3. **Kde přesně držet override limity:** `organization_modules.limits_json` (per modul) vs.
   nový `tenants.entitlement_overrides jsonb` (tenant-wide). Preferováno tenant-wide pro
   cross-modul limity (users).
4. **Napojení na Billing/Stripe:** kdy plán navázat na reálné předplatné a webhooky
   (platba → `applyPlan`), místo ručního přiřazení.
5. **UI:** platform-admin obrazovka pro přiřazení plánu + tenant „hláška o limitu/upgrade".
