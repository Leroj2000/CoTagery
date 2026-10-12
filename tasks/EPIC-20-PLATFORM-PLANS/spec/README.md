# EPIC-20-PLATFORM-PLANS – Předplatné firem, moduly a limity

## Stav: ✅ F1–F3 HOTOVO (2026-10-12) · F4 (Stripe) zbývá

Rozhodnutí uživatele (2026-10-12): 4 úrovně dle návrhu + **limity editovatelné pro úrovně
i jednotlivé firmy**; platby zatím **ručně s fakturou s QR platbou**, Stripe později;
**14 dní zkušebně** (limity/moduly zkušební úrovně mění superadmin), pak Free; superadmin
může **prodloužit o zvolené dny i po splatnosti**. Odchylky od návrhu níže viz ADR-0009
§Implementace (úrovně v DB, výjimky modulů v `tenant_subscriptions.entitlement_overrides`).
Úložiště (`storage_mb`) je limit nad evidencí `storage_objects` (každé nahrání přes `TrackingStorage`; dřívější soubory doplní API při startu).

Navazuje na [ADR-0009](../../../docs/architecture/decisions/0009-platform-plans-entitlements.md)
(hybrid: katalog plánů řídí stav v DB). v2 doplňuje: **předplatné jako životní cyklus**
(zkušební doba, platnost, po splatnosti), **dvouúrovňové řízení modulů** (platforma ×
firma), **funkce uvnitř Tagery Věcí** a **superadmin detail firmy**.

> Pozor na vrstvy: `Subscription`/`tier` v modulu billing (EPIC-17, ADR-0007) je předplatné
> **členů klubu firmy** (Tok 1). Tady jde o předplatné **firmy vůči Tagery** (Tok 2) –
> vlastní tabulky `tenant_subscriptions*`, nemíchat.

## Cíl
1. Superadmin v **Platformě → detail firmy** vidí a mění předplatné firmy, moduly, limity
   a jejich využití.
2. Předplatné (plán) **zapíná moduly/funkce a nastavuje limity** (např. počet položek).
3. Superadmin může firmě modul **natvrdo povolit nebo zakázat** nad rámec plánu.
4. Vlastník firmy v **Nastavení → Rozšíření** přepíná jen moduly, které mu platforma
   povolila; zakázané vidí **zamčené** („Není ve vašem předplatném").
5. Platby: nejdřív ručně (superadmin označí zaplaceno), potom napojení na platební bránu.

## Model (3 vrstvy)

```
 Katalog plánů (kód)          Předplatné firmy (DB)           Efektivní stav (DB, čte authz)
 ───────────────────          ─────────────────────           ─────────────────────────────
 free/start/pro/business  →   tenant_subscriptions        →   organization_modules
  · moduly + funkce            · plan_key, stav, období         · allowed (projekce plánu ⊕ override)
  · limity                     · cena (snapshot), platba        · platform_override (superadmin)
  · cena měsíc/rok             · override limitů                · state (volba vlastníka)
```

### 1. Katalog plánů (kód, `@tagery/shared/plans.ts`)
Typově bezpečný (`PlanKey`, `ModuleKey`, `FeatureKey`, `LimitKey`), sdílený API i webem
(UI ukazuje „co plán obsahuje"). Změna plánu = review + deploy; výjimky pro jednu firmu
řeší override, ne nový plán.

**Moduly** (dnešní `CONTROLLED_MODULES`): `rental`, `product`, `membership`, `ticketing`,
`gallery`, `access`, `billing`. Základ Tagery Věci (položky, QR, místa, lidé) je vždy.

**Funkce** (nové – stupňování samotných Tagery Věcí):

| FeatureKey | Co odemyká |
|---|---|
| `inventory` | inventury skladu (sken) |
| `vehicles` | vozidla a stroje: tachometr, servisní intervaly, inventura vozidel |
| `purchase` | pořízení, ceny, doklady, záruky |
| `import_export` | import/export Excel/CSV, exporty inventur |
| `ai` | AI dohledání návodů a specifikací (náklad na n8n/LLM) |
| `custom_roles` | vlastní role firmy (ADR-0013) |
| `branding` | logo firmy v QR a na štítcích |

**Limity** (`LimitKey`): `assets` (položky), `users` (aktivní členové), `carriers`
(identifikátory/QR), `locations` (místa), `storage_mb` (fotky+doklady), `ai_per_month`.
`null` = neomezeno.

**Návrh úrovní (čísla a ceny k potvrzení):**

| | Free | Start | Pro | Business |
|---|---|---|---|---|
| Cena / měsíc (bez DPH) | 0 | 290 Kč | 790 Kč | individuálně |
| Roční platba | – | 10 měsíců | 10 měsíců | dohodou |
| Položky | 50 | 500 | 5 000 | ∞ |
| Uživatelé | 2 | 5 | 25 | ∞ |
| Identifikátory | 100 | 1 000 | 10 000 | ∞ |
| Místa | 5 | 50 | ∞ | ∞ |
| Úložiště | 500 MB | 5 GB | 50 GB | dohodou |
| AI dotazy / měsíc | 0 | 20 | 200 | dohodou |
| Funkce | – | inventory, import_export, branding | + vehicles, purchase, ai, custom_roles | vše |
| Moduly | – | – | rental | všechny |

### 2. Předplatné firmy (DB)
**`tenant_subscriptions`** – aktuální předplatné (1:1 s firmou, bez RLS jako `tenants`,
čte/zapisuje jen platform-admin + čtení vlastní firmy přes SECURITY DEFINER funkci):

| sloupec | význam |
|---|---|
| `plan_key` | free / start / pro / business |
| `status` | `trialing` · `active` · `past_due` · `suspended` · `canceled` |
| `billing_period` | `month` · `year` · `custom` |
| `current_period_start/end` | zaplacené období |
| `trial_ends_at` | konec zkušební doby |
| `price_amount`, `currency` | cena **snapshot** (změna ceníku nemění běžící předplatné) |
| `payment_method` | `manual` (faktura/převod) · `card` (brána, F4) |
| `limit_overrides` jsonb | výjimky limitů pro firmu (`{"assets": 800}`), typově validované |
| `note` | interní poznámka superadmina |
| `cancel_at_period_end` | zrušení ke konci období |

**`tenant_subscription_events`** – historie (append-only): změna plánu, stavu, období,
override, platba; kdo (superadmin) a kdy. Detail firmy z ní ukazuje časovou osu.

**Životní cyklus:**
```
 nová firma ─► trialing (14 dní, plán Start) ──zaplaceno──► active ──konec období bez platby──► past_due
                     │                                         ▲                                   │ 14 dní grace
                     └──konec trialu bez platby──► free ◄──────┴───── suspended ◄──────────────────┘
```
- **past_due**: vše funguje, firma vidí upozornění „Předplatné po splatnosti".
- **suspended / konec trialu / zrušení**: firma spadne na **efektivní plán Free** – data se
  **nemažou**, nad limitem nejde nic nového založit, moduly mimo Free se vypnou (data zůstanou).
- Stav přepočítává denní job (`SubscriptionLifecycleJob`) + každá změna superadminem.

### 3. Efektivní stav modulů a funkcí (dvě úrovně)
`organization_modules` rozšířit o:
- `allowed boolean` – **projekce** „plán ∪ override" (počítá `applyPlan`), čte authz,
- `platform_override text null` – superadmin: `null` = podle plánu, `'enabled'`, `'disabled'`,
- `state` – zůstává **volba vlastníka firmy** (zapnuto/vypnuto).

**Efektivně aktivní = `allowed` AND `state = 'active'`.** Funkce (`FeatureKey`) se ukládají
stejně (stejná tabulka, `module_key` = `feature:vehicles`), ať je jedna projekce i jeden audit.

| superadmin override | v plánu | allowed | vlastník firmy |
|---|---|---|---|
| podle plánu | ano | ✔ | smí zapnout/vypnout |
| podle plánu | ne | ✖ | zamčené „Není ve vašem předplatném" |
| povoleno | (cokoli) | ✔ | smí zapnout/vypnout |
| zakázáno | (cokoli) | ✖ | zamčené „Vypnuto správcem platformy" |

- `PATCH /modules/:key` (vlastník, `core.module.configure`) **odmítne zapnout** modul s
  `allowed = false` → zavírá self-grant díru z ADR-0009.
- `org_inactive_modules()` (SECURITY DEFINER, guard fáze) vrací moduly, kde
  `NOT allowed OR state = 'inactive'` – authz guard se nemění.
- Funkce se vynucují přes `@RequireFeature('vehicles')` na controllerech (stejný princip jako
  `@RequireModule`) + web skryje navigaci/sekce.

### 4. Limity – `EntitlementsService`
- `resolve(tenantId)` = limity plánu ⊕ `limit_overrides` (override má přednost).
- `usage(tenantId)` = aktuální počty (pod RLS, `count(*)`).
- `assertWithinLimit(key)` na místech vzniku → **`402`** `{ reasonCode: 'plan_limit_reached',
  limitKey, limit, used }`:
  položka (create, import, registrace), identifikátory (batch), pozvánka/aktivace uživatele,
  místo, upload (úložiště), AI požadavek.
- Import: náhled ukáže „překročí limit o N" a nad limitem řádky nezaloží.
- Downgrade: **nic se nemaže** (grandfathering), blokuje se jen vznik nového.

### 5. Platby
- **F1–F3 ručně:** superadmin nastaví plán, období a stav (označí „zaplaceno"); faktura
  mimo systém.
- **F4 – brána** (adaptér jako v billing modulu, PSP volitelný):
  - **Stripe Billing** – karta, opakované platby, faktury, zákaznický portál; webhook
    `invoice.paid` → prodloužení období / `applyPlan`.
  - nebo **CZ varianta** – faktura s QR platbou + párování plateb z banky (Fio API).
  Self-service „Změnit plán" ve firmě až s F4.

## Rozhraní

### Platforma (superadmin)
- **Seznam firem:** sloupce Plán + stav předplatného, ikona ✏️ → detail.
- **`/platform/tenants/[id]` – detail firmy:**
  1. hlavička: název, slug, založeno, vlastník, rychlé počty,
  2. **Předplatné:** plán (výběr), stav, období od–do, zkušební doba, cena, způsob platby,
     poznámka, akce „Prodloužit o měsíc/rok", „Označit zaplaceno", „Zrušit ke konci období",
  3. **Využití a limity:** tabulka limit / v plánu / výjimka (input) / využito (progress bar),
  4. **Moduly a funkce:** řádek = modul; „v plánu ✔/✖", přepínač *Podle plánu / Povolit /
     Zakázat*, stav u firmy (zapnuto/vypnuto vlastníkem),
  5. **Historie** předplatného (události).
- API: `GET /platform/tenants/:id`, `PUT /platform/tenants/:id/subscription`,
  `PUT /platform/tenants/:id/modules/:key` (override), `PUT …/limits`.

### Firma (vlastník/admin)
- **Nastavení → Předplatné** (nová sekce, čtení): plán, stav, platnost, využití limitů
  (progress bary), co plán obsahuje; tlačítko „Požádat o změnu plánu" (F1: e-mail/zpráva
  superadminovi; F4: self-service).
- **Nastavení → Rozšíření:** zamčené moduly se zámkem a důvodem.
- Hláška při dosažení limitu (z `402`): „Dosažen limit 500 položek plánu Start – požádejte
  o vyšší plán."
- Banner při `trialing` (zbývá N dní) a `past_due`.

## Fázování
- **F1 – Předplatné + moduly:** katalog plánů, `tenant_subscriptions(+events)`, `applyPlan`,
  `allowed`/`platform_override`, úprava `/modules` + `org_inactive_modules`, platform detail
  firmy (předplatné, moduly, historie), zamčené moduly u firmy. Backfill: stávající firmy →
  `business` (status `active`, bez konce období), ať se nikomu nic nevypne.
- **F2 – Limity a funkce:** `EntitlementsService`, 402 na místech vzniku, `@RequireFeature`,
  využití v detailu firmy i v Nastavení → Předplatné, hlášky ve webu.
- **F3 – Životní cyklus:** trial pro nové firmy, denní job (past_due → suspended → free),
  bannery, ruční prodloužení/označení platby.
- **F4 – Platby:** napojení brány (Stripe nebo QR faktura + banka), self-service změna plánu.

## Otevřené otázky (k potvrzení)
1. Úrovně a čísla limitů/cen v tabulce výše.
2. Platby: Stripe (karta) vs. QR faktura + párování z banky (nebo obojí).
3. Nové firmy: začínat trialem (14 dní Start) nebo rovnou Free?
4. Stávající firmy při zavedení: `business` (nic se nezmění) – OK?

## Definition of Done
Viz `tasks/ROADMAP.md` §DoD. Navíc: izolační test – firma nepřekročí limit, nezapne modul
ani funkci mimo plán/override; downgrade nemaže data; vlastník nevidí ani nemění
předplatné jiné firmy; superadmin změny jsou v historii.
