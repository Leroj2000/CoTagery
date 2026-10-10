# ADR 0013: Role spravované firmou – matice oprávnění, hierarchie a delegace

- Stav: přijaté
- Datum: 2026-10-10

## Kontext

Role byly datové balíčky oprávnění (EPIC-18), ale společné pro všechny firmy. Firma si je nemohla
upravit ani vytvořit vlastní a kdokoli s `core.role.manage` mohl přidělit libovolnou roli včetně
vlastníka (eskalace). Autorizace navíc četla roli z JWT, takže odebraná role platila až do
vypršení access tokenu (15 min).

## Rozhodnutí

Po vzoru Dynamics/Power Platform security roles, Odoo access rights, GitHub custom roles,
Salesforce role hierarchy a AWS permission boundaries:

- **Matice**: oprávnění `modul.zdroj.akce` se v UI skládají do řádků (zdroj) a sloupců
  Zobrazit / Zakládat / Upravovat / Mazat + speciální akce (přidělovat, schvalovat…).
  Mapování a české popisky jsou ve `@tagery/shared` (`roles.ts`), neznámé zdroje spadnou do
  „Ostatní". Akce se zdrojem implikuje jeho zobrazení.
- **Šablony a vlastní role**: systémové role (`roles.tenant_id IS NULL`) jsou šablony. První úprava
  vytvoří kopii pro firmu se stejným klíčem (copy-on-write), „Obnovit výchozí" ji smaže. Vlastní
  role mají klíč `c_…`. Efektivní roli vrací `tenant_role_info` / `tenant_role_permission_keys`
  (SECURITY DEFINER, firemní řádek má přednost).
- **Hierarchie**: `roles.rank` (owner 100, admin 80, manager 60, editor 40, viewer 20,
  scan_only 10; vlastní role těsně pod zvolenou rolí). Role spravuje a přiděluje jen role
  s nižší úrovní a mění roli jen podřízeným uživatelům, nikdy sobě.
- **Delegace bez eskalace**: aktér smí v roli zapnout či vypnout jen oprávnění, která sám má
  (`(požadované ∩ aktérova) ∪ (dosavadní ∖ aktérova)`); totéž platí pro založení role.
- **Vlastník** má vždy celý katalog (`all_permissions`), nelze ho upravit a firma musí mít
  aspoň jednoho aktivního vlastníka. Systémová šablona admin má `all_permissions`, dokud ji
  firma neupraví.
- **Aktuální role**: `AuthzService` bere roli z členství (`my_memberships`), ne z JWT; cache
  60 s se při změně role nebo přidělení hned maže.
- **RLS**: šablony jsou jen ke čtení (oddělené policy pro SELECT/INSERT/UPDATE/DELETE – dřívější
  policy dovolovala unést šablonu přepsáním `tenant_id`), `role_permissions` má RLS přes
  vlastnictví role.
- Každá změna role a přidělení jde do `audit_events`.

## Důsledky

Kdo smí spravovat role, určuje oprávnění „Role a oprávnění → Spravovat" (`core.role.manage`).
Výchozí manažer ho nemá, vlastník nebo admin ho může zapnout, a manažer pak spravuje role pod
sebou. Nová oprávnění přidaná migrací dostane jen vlastník, systémový admin a role, kterým je
migrace výslovně přidá. Upravené a vlastní role firmy je nedostanou automaticky.
