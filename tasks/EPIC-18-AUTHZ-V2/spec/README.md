# EPIC-18-AUTHZ-V2 – Autorizační architektura + multi-org identita

## Stav: 🟡 FÁZE 0 KOMPLETNÍ a e2e ověřená (2026-08-19); Fáze 1+ ke schválení

### Hotovo (0.3 + 0.4)
- [x] 0.3: tenant-context interceptor vynucuje AKTIVNÍ členství v aktivní org (COUNT pod RLS) – odebrané členství = deny i s platným tokenem (e2e: suspend → 403, org1 dál 200)
- [x] 0.4: web přepínač organizace v admin headeru (OrgSwitcher) + BFF `/api/switch-org` (přepíše cookies); e2e: přepnutí Demo Tenant→Druhá Firma změní header na MANAGER a dashboard na prázdnou org

### Hotovo (0.1 + 0.2)
- [x] `org_memberships` (název `memberships` patří EPIC-16) + `role_assignments` (RLS) + backfill (3 users → 3 členství)
- [x] users globální unikátní email; entity `OrgMembership`, `RoleAssignment`
- [x] `my_memberships()` SECURITY DEFINER (identity-layer čtení napříč orgy)
- [x] login/refresh vydávají token pro aktivní org z membershipu; `POST /auth/switch-org`; `GET /auth/memberships`
- [x] invite/updateRole/seed zakládají/srovnávají membership
- [x] **e2e ověřeno:** identita ve 2 orgách (Demo Tenant=OWNER, Druhá Firma=MANAGER); přehled členství; přepnutí org → jiná role; izolace (org1 46 assetů / org2 0); switch bez členství → 403; refresh drží aktivní org

## Cíl
Přijmout autorizační model z technického zadání (`technicke_zadani_autorizacni_a_modularni_architektura.docx`):
5 oddělených konceptů — **identita+membership → role (balíček permissions) → scope (rozsah dat) → entitlement (modul) → policy (podmínka)** — s centrální `authorize()`.
Rozhodnuto (uživatel 2026-08-18): **jedna identita ve více organizacích** (User/Membership split) jako první krok.

## Výchozí stav (co měníme)
- `users` jsou **tenant-scoped** (`tenant_id` na řádku) → jeden člověk = jeden účet v jedné firmě.
- Role = **hardcoded hierarchické ranky** SCAN_ONLY→OWNER (`tenant-role-rank.ts`, `@RequireRole`), vynucené jen na **mutacích**; čtení role neomezuje.
- Object-ACL (`ObjectPermission`) = model + `check()`, ne plošný guard.
- **Zůstává:** multi-tenant **RLS** (FORCE, non-superuser `tagery_app`, tenant z JWT), `Location.parentId` (strom), přístupový modul (precedent policy).

## Princip řízení: schvalování krok po kroku
Každý **krok** níže je samostatná dodávka s vlastní **schvalovací bránou** ✋.
Nezačínám další krok, dokud předchozí není odsouhlasen. Každý krok: cíl → dodávka → migrace/riziko → akceptace.

---

## FÁZE 0 — User/Membership split (identita) — dělá se první

### ✋ Krok 0.1 — Datový model identity + migrace
- **Dodávka:** `users` = globální identita (odpojit `tenant_id`). Nové tabulky:
  `memberships` (user_id, organization_id, status, primary_role_id),
  `role_assignments` (membership_id, role_id, scope_type, scope_ref, valid_from, valid_to).
- **Migrace (backfill):** každý stávající user → 1 membership v jeho současném tenantovi + 1 role_assignment se stávající rolí (scope ORGANIZATION). Bez ztráty přístupu.
- **Riziko:** dotýká se `users` (login, invite, JWT). Cross-tenant FK zakázat (app + DB).
- **Akceptace:** stávající účty se přihlásí beze změny; každý má právě 1 membership; RLS drží.

### ✋ Krok 0.2 — Auth flow + JWT s aktivní organizací + přehled členství
- **Dodávka:** login vrátí **seznam členství**; JWT nese `userId` + `activeOrganizationId` (+ `membershipId`, `tenantRole` v rámci org). Endpoint `POST /auth/switch-org` vydá token pro zvolené členství (jen z členství uživatele).
  Navíc `GET /me/memberships` — **přehled všech organizací, kde je identita registrovaná** (org, role, status, od kdy).
- **Identity layer (důležité vůči RLS):** `users`/`memberships`/`role_assignments` jsou **nad** per-org daty. „Moje členství napříč orgy" se čte **na úrovni identity podle `user_id`**, ne pod `app.tenant_id` jedné org — přes řízenou cestu (SECURITY DEFINER `my_memberships(user_id)` / identity service, stejný vzor jako login/resolver). Vrací **jen metadata členství** dané identity, NE interní data organizací.
- **Dvě úrovně přehledu:** (a) seznam org + moje role/stav = součást tohoto kroku; (b) *agregovaná* cross-org data (např. „moje úkoly ze všech firem") = samostatná feature nad tímhle (iterace per-org kontextů), mimo Fázi 0.
- **Riziko:** změna tvaru JWT + refresh; ověřit, že aktivní org je vždy z členství usera; identity-lookup nesmí prosáknout data cizí org.
- **Akceptace:** identita se 2 členstvími vidí přehled obou org, přepne se, dostane správný token; přepnutí na org bez členství = 403; přehled neukáže interní data žádné org.

### ✋ Krok 0.3 — Tenant-context z membershipu
- **Dodávka:** `app.tenant_id` (RLS) se nastaví z `activeOrganizationId` v JWT (validováno proti členstvím), místo z pole na userovi. `tenant-transaction.interceptor` + `TenantContextService`.
- **Riziko:** nízké (RLS mechanika beze změny), ale kritická cesta.
- **Akceptace:** data jsou vidět jen pro aktivní org; přepnutí org přepne viditelnost; izolace mezi tenanty otestovaná.

### ✋ Krok 0.4 — Web: přepínač organizace
- **Dodávka:** po loginu výběr org (pokud >1), přepínač org v adminu; BFF cookie/relace nese aktivní org; middleware honoruje.
- **Akceptace:** UI ukáže aktivní org, přepnutí funguje, deep-linky respektují aktivní org.

**Výstup fáze 0:** jedna identita, N členství, přepínání org, RLS izolace zachována.

---

## FÁZE 1 — Permission katalog + data-driven role + `authorize()`

### ✋ Krok 1.1 — Katalog permissions + role jako data
- **Dodávka:** `permissions` (key `namespace.resource.action`, module_key, resource, action, sensitivity, dependencies), `roles` (organization_id nullable = system, key, name, system_flag), `role_permissions`. Seed **core katalog** (`core.*`, `asset.*`).
- **Akceptace:** permission je stabilní klíč; `update` deklarativně závisí na `view`.

### ✋ Krok 1.2 — Systémové role jako šablony (mapování našich 6)
- **Dodávka:** namapovat SCAN_ONLY→OWNER na šablony zadání jako balíčky permissions
  (návrh: OWNER→*Organization Administrator*, ADMIN→*Organization Administrator* (bez platform), MANAGER→*Organization Manager*, EDITOR→*Member*+provozní balíček, VIEWER→*Member* (jen view), SCAN_ONLY→*Member* (jen scan)). Role templates vs. tenant instance.
- **Akceptace:** stávající uživatelé mají po migraci ekvivalentní práva jako dnes.

### ✋ Krok 1.3 — Centrální `authorize()`
- **Dodávka:** služba `authorize(user, permissionKey, resource?, scope?)` s prioritou zadání:
  hard deny > neaktivní org/membership/modul > chybějící permission > mimo scope > nesplněná policy > allow. **Default deny.** Vrací allow/deny + `reasonCode`.
- **Akceptace:** rozhodnutí podle **permission key**, ne názvu role; strojově čitelný důvod.

### ✋ Krok 1.4 — Nahradit `@RequireRole` za `@RequirePermission` (po modulech)
- **Dodávka:** guard `@RequirePermission('asset.item.update')` napříč controllery (mechanické, ~55 mutací + doplnit **čtecí** gating, čímž se opraví dnešní „čtení nehlídá roli").
- **Akceptace:** mutace i čtení gated permissionem; změna obsahu role se projeví bez editace uživatelů.

---

## FÁZE 2 — Scope (location-tree)

### ✋ Krok 2.1 — Scope grants
- **Dodávka:** scope na `role_assignments`: MVP `ORGANIZATION` / `LOCATION_TREE` / `OWN`. (`Location.parentId` už existuje.)
### ✋ Krok 2.2 — Vynucení scope v DB dotazu
- **Dodávka:** list endpointy filtrují scope **v dotazu** (ne post-filtrem); helper predikát nad RLS.
- **Akceptace:** „Manager jen pro 2 lokality" (scénář 17.1) vidí jen ty lokality a jejich potomky.

---

## FÁZE 3 — Entitlementy modulů
### ✋ Krok 3.1 — `organization_modules`
- **Dodávka:** stav modulu per org (active/inactive/limits); `authorize()` ho zahrne; UI skryje vypnuté moduly.

---

## FÁZE 4 — Policy engine + audit
### ✋ Krok 4.1 — Policy engine
- **Dodávka:** deklarativní allow/deny + reason (časová okna, stav resource…); zobecnit přístupový modul.
### ✋ Krok 4.2 — `audit_events`
- **Dodávka:** audit změn rolí, membership, scope, entitlementů (actor, before/after, context).

---

## Mimo rozsah (zatím)
- TEAM / RESOURCE_SET scope, platform-level role (Platform Admin/Operator), Technical Client účty — až po MVP.

## Závislosti
- Staví na EPIC-01 AUTH, EPIC-03 CORE-DOMAIN, EPIC-06 RBAC-ACL (object-ACL se vtělí do scope/grantů).

## Reference
- Zadání: `technicke_zadani_autorizacni_a_modularni_architektura.docx` (kap. 5–8, 10, 13, 16, přílohy A–C)
- Rozhodnutí: paměť `authz-multiorg-direction`
