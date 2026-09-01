# EPIC-21-MARKETPLACE-NETWORK – Síť / discovery nad půjčovnou

## Stav: 🟡 F1 HOTOVO (opt-in + follow graf + renter API, ověřeno e2e) · F2/F3 čeká

**F1 (hotovo):** `tenants.network_listed` (opt-in přepínač v `/admin/settings`); tabulka
`network_follows` (mimo tenant RLS) + SECURITY DEFINER `network_follow` / `network_unfollow`
/ `network_followed_tenants`; renter API `GET/POST/DELETE /network/follows`. Follow jen na
firmu opt-in (jinak 404). Modul `apps/api/src/modules/network`.

Sociální/discovery vrstva nad marketplace: **účet nájemce sleduje firmy (tenanty)** a
dostává feed jejich publikovaných inzerátů. Bez samostatného ADR – řídí se **ADR-0002**
(RLS + `SECURITY DEFINER` pro cross-tenant čtení veřejné projekce). Tento spec je *co
postavit*.

## Cíl
Proměnit izolované půjčovny v **objevitelnou síť**: nájemce najde a začne sledovat firmy,
jejichž půjčované produkty ho zajímají, a má jeden **feed** napříč firmami. Network-effect
tah – víc cross-tenant poptávky a důvod přidávat víc inzerátů; odlišovač vůči obyčejnému
QR SaaS. Rozšiřuje [[EPIC-19-RENTAL-MARKETPLACE]] (veřejný storefront) o **objevování +
follow**.

## Co už je hotové (na čem se staví)
- **Publikované inzeráty** – `rental_listing` (`status='published'`, `slug`, `published_at`,
  ceník, `asset_id`) + veřejný storefront `/pujcovna/[tenant]`.
- **Cross-tenant veřejné čtení** – `SECURITY DEFINER` funkce (`public_listings(filter)` /
  `public_listing(slug)`, migrace `1770…-InitRental` / `1906…-RentalOrder`) čtou publikované
  inzeráty **mimo tenant kontext** bez porušení RLS (ADR-0002).
- **Účet nájemce** – `renter-auth` + `renter-jwt.guard` (login mimo org identitu) a
  platform-shared `renter_profiles` (reputace napříč tenanty, EPIC-10). → přirozená
  identita **follower-a**.
- **Platform-admin vrstva** – [[platform-admin-layer]] (moderace/reporty patří sem, F4).

## Rozhodnutí (osi produktu)
- **Model = B2C:** follower = **účet nájemce**, followee = **tenant (firma)**. NE tenant→tenant
  (B2B kurátorství) a NE org member.
- **Follow je platformní, ne tenant-scoped** – vlastní ho nájemce, ne firma. Tabulka žije
  **mimo tenant RLS** (jako `users` / `renter_profiles`); zápis pod renter-jwt.
- **Čte se jen veřejná projekce** – feed i discovery stojí VÝHRADNĚ nad `SECURITY DEFINER`
  funkcemi; nikdy ne nad tenant-private tabulkami. (Tvrdý mantinel izolace.)

## Rozsah (MVP)
1. **Opt-in viditelnost firmy** – `tenants.network_listed` (bool, **default false**) +
   přepínač v nastavení firmy. Bez opt-in se firma v discovery/feedu neukáže (i když má
   publikované inzeráty na vlastním storefrontu). GDPR/kontrola viditelnosti.
2. **Follow graf** – `network_follows` (`renter_user_id`, `tenant_id`, `created_at`, unikát
   na dvojici), platform-global. API pod renter-jwt: `POST/DELETE /network/follows/:tenantId`,
   `GET /network/follows` (seznam sledovaných). Sledovat jen firmu s `network_listed=true`.
3. **Feed** – `GET /network/feed` (renter-jwt): publikované inzeráty sledovaných firem,
   řazené dle `published_at`, stránkované. Rozšířit `public_listings` o filtr `tenant IN (…)`
   a `network_listed=true`.
4. **Discovery / procházení** – `GET /network/discover` (anon i nájemce): všechny
   `network_listed` firmy + jejich inzeráty, hledání dle **kategorie / lokality / textu**.
5. **Profil firmy v síti** – rozšíření `/pujcovna/[tenant]` o **follow tlačítko** (+ volitelně
   počet sledujících).
6. **Web:** `/sit` (feed přihlášeného nájemce) + discovery/hledání; follow tlačítka na
   storefront/listing; „Sledované firmy" v `/najem`.

## Explicitně mimo MVP (později)
- Featured / **placené umístění** („prodávat do sítě") – monetizace, navazuje na plány.
- Notifikace o nových inzerátech sledovaných firem.
- Komentáře / hodnocení příspěvků; sociální interakce nad rámec follow.
- **Moderace / reporty** (spam, falešné firmy) – sedne na [[platform-admin-layer]].
- Follow mezi tenanty (B2B kurátorství).

## Fázování
- **F1 – Opt-in + follow graf:** `tenants.network_listed`, `network_follows`, follow/unfollow
  API + „sledované" seznam. E2e: follow → v seznamu; ne-listed firma nejde sledovat.
- **F2 – Feed:** `/network/feed` nad `SECURITY DEFINER`; web `/sit`. E2e: publikovaný inzerát
  sledované firmy je ve feedu; nepublikovaný / ne-listed firma není.
- **F3 – Discovery + profil firmy:** procházení/hledání (kategorie/lokalita/text), follow
  tlačítka na storefront, počty sledujících.
- **F4 – Post-MVP:** notifikace, featured/placené umístění, moderace/reporty.

## Otevřené otázky (dořešit před/při stavbě)
1. **Default `network_listed`** – opt-in (`false`, bezpečnější/GDPR, doporučeno) vs opt-out.
2. **Granularita follow** – MVP jen firma; sledování kategorie/konkrétního inzerátu později?
3. **Řazení discovery** – MVP dle `published_at`; zapojit reputaci/kvalitu (`renter_profiles`,
   hodnocení) později.
4. **Vazba na plány** ([[EPIC-20-PLATFORM-PLANS]]) – je „být v síti" feature vázaná na SaaS
   plán firmy? (Pravděpodobně později.)

## Závislosti
- **EPIC-19 marketplace** (inzeráty, účet nájemce, `public_listings` SECURITY DEFINER,
  `/pujcovna` storefront), **EPIC-10 RENTAL** (`renter_profiles`), **ADR-0002** (RLS +
  SECURITY DEFINER cross-tenant čtení). Volitelně **EPIC-20** (gating „sítě" plánem).

## Definition of Done
Viz `tasks/ROADMAP.md` §DoD. Navíc **izolační test**: feed i discovery čtou VÝHRADNĚ
publikované inzeráty `network_listed` firem přes `SECURITY DEFINER`; žádný přístup k
tenant-private datům; ne-listed firma není objevitelná; renter token nevidí nic mimo
veřejnou projekci.
