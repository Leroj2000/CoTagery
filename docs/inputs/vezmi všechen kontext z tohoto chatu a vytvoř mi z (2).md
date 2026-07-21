<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# vezmi všechen kontext z tohoto chatu a vytvoř mi zadání pro vývoj takové webové responzivní aplikace

Níže máš ucelené **zadání pro vývoj** webové responzivní aplikace, které integruje vše, co jsme v chatu postupně navrhli: dynamické QR, NFC, moduly pro retail, eventy, půjčování, návyky, automatizace i marketplace model s rolemi a oprávněními.

***

## 1. Cíl a hlavní koncept

Vyvinout **multi‑tenant SaaS platformu** (responzivní webová aplikace) pro:

- správu **dynamických QR kódů** a **NFC tagů**,
- jejich přiřazování k různým typům „digitálních objektů“ (produkty, vstupenky, půjčované věci, galerie, tracking body, automatizační scény, vizitky…),
- provoz nadstavbových **modulů**, které řeší konkrétní scénáře (retail, eventy, půjčování, domácnost, IoT, návyky, docházka, sdílení fotek),
- fungování v režimu **marketplace/B2B** – jedna firma (tenant) vytváří „repository“ objektů, přidává pod sebe uživatele a nastavuje, kdo co smí.

Cílem je **jedna platforma**, skrz kterou lze QR a NFC použít ve velkém množství use‑casů, ale se společným jádrem, bezpečností a analytikou.

***

## 2. Technologický rámec (doporučení)

- Frontend: React / Next.js nebo obdobný moderní framework (SSR/SPA hybrid), mobile‑first.
- Backend: Node.js + TypeScript (např. NestJS / Express) nebo jiný stack dle týmu.
- Databáze: PostgreSQL (relační + JSONB pro flexibilní metadata).
- API: REST (s možností pozdějšího GraphQL).
- Auth: JWT nebo session‑based, připravené na OAuth2 / SSO.
- Hosting: cloud (AWS / GCP / Azure), připravené na multi‑tenant režim.

***

## 3. Core doména a multi‑tenant model

### 3.1 Tenanti, lokace, uživatelé

**Tenant** = firma / organizace / zákazník v marketplace modelu.

Entity:

- `Tenant`
    - id
    - name
    - type: `retail`, `event`, `rental`, `home`, `mixed`…
    - branding_domain (subdoména, white‑label)
    - settings_json (globální konfigurace tenantu)
    - created_at, updated_at
- `Location`
    - id
    - tenant_id
    - name
    - type: `store`, `venue`, `warehouse`, `office`, `home`
    - address
    - timezone
    - created_at, updated_at
- `User`
    - id
    - tenant_id
    - email
    - name
    - tenant_role: `OWNER`, `ADMIN`, `MANAGER`, `EDITOR`, `VIEWER`, `SCAN_ONLY`
    - status
    - created_at, updated_at

Volitelně pro větší firmy:

- `Group`
    - id
    - tenant_id
    - name
- `GroupMember`
    - group_id
    - user_id


### 3.2 DigitalObject – „virtuální objekt“ pro všechny moduly

Každý QR/NFC kód vede na nějaký **digitální objekt**. Ten říká, jaký modul se má použít.

- `DigitalObject`
    - id
    - tenant_id
    - module_type (enum):
        - `product`
        - `loyalty`
        - `pay`
        - `inventory`
        - `trace`
        - `ticket`
        - `rental`
        - `gallery`
        - `time_tracker`
        - `automation`
        - `contact`
    - slug (pro lidsky čitelné URL)
    - status: `active`, `inactive`, `archived`
    - primary_url (pro integrace, deep‑link)
    - metadata_json (volná modulová metadata)
    - valid_from, valid_to
    - created_at, updated_at


### 3.3 DataCarrier – QR a NFC nosiče

Fyzický nosič (QR, NFC, nebo hybrid). Stejný `DigitalObject` může mít více nosičů.

- `DataCarrier`
    - id
    - digital_object_id
    - carrier_type: `qr`, `nfc`, `hybrid`
    - public_code (krátký identifikátor v URL – např. `abc123`)
    - resolver_url (plná URL, na kterou se kód mapuje)
    - qr_payload (obsah QR, pokud je odlišný; jinak se použije resolver_url)
    - nfc_uid (UID tagu, pokud známé)
    - nfc_payload (např. NDEF URI)
    - version
    - status: `active`, `replaced`, `lost`, `destroyed`
    - created_at, updated_at


### 3.4 ScanEvent – log všech scanů/tapů

Pro analytiku, reporting, bezpečnost.

- `ScanEvent`
    - id
    - digital_object_id
    - data_carrier_id
    - carrier_type (`qr` nebo `nfc`)
    - event_type: `scan`, `tap`, `open`, `checkin`, `checkout`, `upload`, `pay`, `return`, `habit`
    - user_id / person_id (pokud identifikováno – např. pro docházku)
    - device_info_json
    - ip_address
    - location_hint (geo nebo odvozeno z Location)
    - created_at

***

## 4. RBAC a marketplace / ACL model

### 4.1 Globální role v rámci tenantu

- `OWNER` – full control v tenantu (všechno + správa práv).
- `ADMIN` – správa lidí, modulových nastavení, ale bez některých „owner“ akcí (např. zrušení tenantu).
- `MANAGER` – správa objektů a operací v rámci modulů, ale ne globální nastavení a fakturace.
- `EDITOR` – vytváření a úprava objektů, bez správy práv.
- `VIEWER` – read‑only přístup (podle ACL).
- `SCAN_ONLY` – žádný přístup do admin UI, jen operace přes scan/tap (check‑in, docházka, půjčení atd.).


### 4.2 Per‑objektová oprávnění (ACL)

Tabulka:

- `ObjectPermission`
    - id
    - digital_object_id
    - tenant_id
    - subject_type: `user`, `group`, `tenant`
    - subject_id: id uživatele / skupiny / speciální hodnota pro celý tenant
    - permission: `owner`, `manage`, `edit`, `view`, `scan_only`
    - created_at
    - expires_at (volitelné)

Pravidla:

- `OWNER` tenantu má implicitně `owner` na všechny objekty v tenantu.
- `ADMIN` má minimálně `manage` na všechny objekty (nebo podle business pravidel).
- `ObjectPermission` určuje, kdo ve firmě vidí / upravuje konkrétní objekt (např. konkrétní půjčovanou věc, konkrétní galerii, konkrétní tracking bod).
- Pokud existuje záznam `subject_type=tenant, permission=view`, všichni uživatelé tenantu objekt vidí.

***

## 5. Moduly – doménový model a use‑casy

Každý modul navazuje na `DigitalObject` a implementuje vlastní entity a logiku. Resolver přesměruje na modul podle `module_type`.

### 5.1 Product modul

Use‑case:

- QR/NFC na obalu nebo v regálu → produktová karta (složení, původ, recenze, návody, cross‑sell).
- Budoucí možnost GS1 Digital Link (GTIN, šarže), ale není nutné pro první verzi.

Entity (základ):

- `Product`
    - digital_object_id
    - gtin
    - brand
    - name
    - description
    - ingredients
    - origin
    - care_instructions
    - media (vazba na obrázky, videa)
    - reviews (vazba)


### 5.2 Loyalty modul

Use‑case:

- QR/NFC na účtence, plakátu, stojanu → přihlášení do věrnostního programu, sbírání bodů, kupony.

Entity:

- `Customer`
- `LoyaltyAccount`
- `PointsTransaction`
- `Coupon`
- `Campaign`


### 5.3 Payment modul (Scan \& Pay)

Use‑case:

- QR na účtence / na stole / u pokladny → zaplatit účet (Qerko‑like), Scan \& Pay v retailu.

Entity:

- `Bill` / `Order`
- `PaymentSession`
- `PaymentMethod`
- `Receipt`


### 5.4 Inventory modul

Use‑case:

- QR/NFC na boxech, ve skladu, na krabicích – zobrazit obsah, provést inventuru, změnit množství.

Entity:

- `StockItem` / `Container`
- `Movement`
- `InventorySession`


### 5.5 Trace / Compliance modul

Use‑case:

- QR na produktu → info o šarži, expiraci, certifikaci, recyklaci, Digital Product Passport (DPP).

Entity:

- `Batch`
- `Certification`
- `Recall`
- `DppRecord`


### 5.6 Ticketing modul

Use‑case:

- Prodej vstupenek na akce (konference, koncerty, kluby), QR/NFC vstupenka, check‑in u vchodu.

Entity:

- `Event`
- `TicketType`
- `Ticket`
- `CheckIn`

Tok:

1. Vytvořit `Event` + `TicketType`.
2. Prodej → vytvořit `Ticket` + `PaymentSession`.
3. Po úspěšné platbě: `Ticket.status = paid`, vygenerovat QR/NFC (DataCarrier).
4. Na vstupu: scan → modul ověří ticket (paid, not redeemed), vytvoří `CheckIn`, nastaví `redeemed`.

### 5.7 Rental modul (půjčování věcí)

Use‑case:

- QR/NFC na půjčované věci (nářadí, technika, kola, interní vybavení).
- Po skenu vidím: komu je půjčeno, do kdy, za kolik, fotky při výdeji, návod, stav.

Entity:

- `Item`
    - digital_object_id
    - owner_id (Tenant / Location)
    - name
    - description
    - serial_number
    - photos_json
    - care_manual_url
    - price_per_day
    - deposit
- `RentalContract` / `Loan`
    - item_id
    - borrower_id (User / kontakt)
    - rental_start
    - rental_end
    - price_total
    - deposit
    - status (`active`, `returned`, `cancelled`)
- `ConditionReport`
    - loan_id
    - type (`handover`, `return`)
    - photos_json
    - notes
    - damage_assessed


### 5.8 Shared Gallery modul

Use‑case:

- Sdílené galerie fotek/videí z eventů, nebo za fyzickými fotkami.
- QR/NFC → upload stránka, galerie, automatické mazání po čase.

Entity:

- `GalleryEvent`
    - digital_object_id
    - name
    - date
    - owner_id
    - upload_deadline
    - delete_after_days
    - is_private
- `GalleryAccess`
    - gallery_event_id
    - token
    - access_level (`upload`, `view`, `manage`)
- `UploadItem`
    - gallery_event_id
    - uploader_id (pokud znám)
    - file_url
    - mime_type
    - created_at
    - status (`pending`, `approved`, `rejected`)
- `ModerationFlag`
- `RetentionPolicy`


### 5.9 Time \& Event Tracking modul

Use‑case:

- Docházka (příchod/odchod z práce), sledování času, Pomodoro.
- Návykové události: léky, čištění zubů, pitný režim, fitko.
- Parkování (uložení polohy).

Entity:

- `TimeTrackingPoint`
    - digital_object_id
    - tenant_id
    - location_id
    - name
    - type (`work_entry_exit`, `habit_event`, `task_checkpoint`, `parking`)
    - description
    - settings_json (např. jak párovat in/out)
- `TimeEvent`
    - time_tracking_point_id
    - digital_object_id
    - data_carrier_id
    - user_id
    - event_role (`clock_in`, `clock_out`, `habit`, `break_start`, `break_end`, `parking_spot`)
    - timestamp
    - device_info_json
    - extra_data_json
- `TimeSession`
    - user_id
    - start_event_id
    - end_event_id
    - start_time
    - end_time
    - duration_seconds
    - location_id
    - status (`open`, `closed`, `auto_closed`)
- `HabitCounter`
    - user_id
    - time_tracking_point_id
    - period (`day`, `week`, `month`)
    - period_start
    - period_end
    - event_count
    - streak_days


### 5.10 Automation modul (scény / akce)

Use‑case:

- Ovládání světel/žaluzií, nastavení telefonu (Focus mode, BT, Wi‑Fi), spuštění playlistu, navigace + SMS ETA.
- QR/NFC = spouštěč scén.

Entity:

- `AutomationScene`
    - digital_object_id
    - tenant_id
    - name
    - description
    - trigger_settings_json
- `AutomationAction`
    - scene_id
    - order
    - action_type (`webhook`, `http_request`, `open_url`, `os_shortcut`, `send_message`, `start_timer`)
    - action_config_json

Klient (browser / app) nebo backend pak provede konkrétní akce podle konfigurace.

### 5.11 Contact / Identity modul

Use‑case:

- Digitální vizitky, sdílení kontaktů, sociální profily.

Entity:

- `ContactCard`
    - digital_object_id
    - name
    - position
    - company
    - email
    - phone
    - website
    - social_links_json
    - vcard_payload

***

## 6. Resolver a směrování

### 6.1 Veřejný resolver

- Endpoint: např. `GET /r/{public_code}`.
- Kroky:

1. Najít `DataCarrier` podle `public_code`.
2. Zkontrolovat `status` a časovou platnost (`valid_from`, `valid_to` u DigitalObject).
3. Načíst `DigitalObject` a podle `module_type` zavolat odpovídající modulový handler.
4. Zalogovat `ScanEvent`.
5. Vrátit:
        - HTML (user‑facing stránka) nebo
        - JSON (pro appku).


### 6.2 Modulové handlery

Každý modul implementuje funkci typu:

- `handleScan(digitalObject, dataCarrier, requestContext) -> response`

která:

- provede business logiku (např. check‑in ticketu, vytvoření TimeEvent, vytvoření UploadItem),
- vrátí odpovídající stránku/JSON.

***

## 7. RBAC: role × oprávnění × modul

### 7.1 Typy oprávnění na objektu

- `owner` – plná práva k objektu (včetně správy ObjectPermission).
- `manage` – správa objektu a modulových entit, ale ne mazání objektu a změna ownera.
- `edit` – úprava dat (karty, obsahu, stavů).
- `view` – jen čtení.
- `scan_only` – žádný admin UI, jen operace přes scan/tap (např. check‑in, docházka).


### 7.2 Modulové maticové chování (shrnutí)

Příklady:

- **Product**
    - `manage`: vytvářet/mazat produkty, měnit stav.
    - `edit`: upravovat texty, fotky, návody.
    - `view`: zobrazit kartu + statistiky.
- **Ticketing**
    - `manage`: vytvářet eventy, typy vstupenek, nastavovat prodej.
    - `edit`: upravovat konkrétní eventy.
    - `view`: prodeje, účastníci.
    - `scan_only`: check‑in/check‑out u dveří.
- **Rental**
    - `manage`: správa věcí, ceníků, stavu.
    - `edit`: vytvářet/vypovídat půjčky, fotit stav.
    - `view`: přehled, historie.
    - `scan_only`: půjčování/vracení přes scan.
- **Shared Gallery**
    - `manage`: správa galerie, moderace, export.
    - `edit`: úprava jedné galerie, moderace obsahu.
    - `view`: prohlížení.
    - `scan_only`: upload přes QR.
- **Time \& Event Tracking**
    - `manage`: definice tracking bodů, reporty, export.
    - `edit`: korekce session, správa konkrétních bodů.
    - `view`: reporty.
    - `scan_only`: clock in/out, log návyků.
- **Automation**
    - `manage`: definice scén a akcí.
    - `edit`: úprava konkrétních scén.
    - `view`: seznam scén, statistiky.
    - `scan_only`: spouštění scén.
- **Contact**
    - `manage`: firemní vizitky a šablony.
    - `edit`: úprava vizitky (typicky vlastní).
    - `view`: prohlížení vizitek.
    - `scan_only`: načtení vizitky přes QR/NFC.

Backend musí u každého API koncového bodu:

- určovat `tenant`, `user`, `tenant_role`,
- ověřovat, že user má na daný `DigitalObject` switchem:
    - buď globální právo (OWNER/ADMIN) nebo
    - odpovídající `ObjectPermission.permission`.

***

## 8. Webové UI – funkční požadavky

### 8.1 Responzivní design

- Mobile‑first, aby šla správa i z telefonu.
- Desktop layout pro pohodlnou práci (tabulky, filtry, statistiky).


### 8.2 Hlavní sekce

1. **Dashboard**
    - Přehled základních statistik:
        - počet DigitalObject,
        - skeny podle modulů,
        - poslední aktivity (ScanEvent).
2. **Repository / Objects**
    - Listing DigitalObject (filtrovat podle modulu, lokace, stavu).
    - Detail objektu:
        - základní data,
        - přehled DataCarrierů (QR/NFC),
        - modulově specifická karta (product, ticket, rental…),
        - záložka Oprávnění (ObjectPermission),
        - záložka Analytika (ScanEvent).
3. **Carriery (QR \& NFC)**
    - Přehled všech DataCarrier.
    - Generování QR (download PNG/SVG, tisková verze).
    - Párování NFC (zápis/čtení nfc_uid, test).
4. **Moduly**
    - Product: správa produktů, detail karty.
    - Ticketing: správa eventů, vstupenek, check‑in dashboard.
    - Rental: správa věcí, půjček, reporty.
    - Shared Gallery: správa galerií, upload, moderace.
    - Time \& Event: správa tracking bodů, docházkové reporty, návyky.
    - Automation: správa scén a akcí.
    - Contact: vizitky pro tým.
5. **Team \& Roles**
    - Management uživatelů a skupin v tenantu.
    - Nastavení tenant_role.
    - Invite flows (invitační e‑maily).
6. **Settings**
    - Tenant branding (logo, barvy).
    - Defaultní nastavení modulů (např. výchozí retence galerií).

***

## 9. MVP rozsah

Pro první verzi se doporučuje:

1. **Core \& RBAC**
    - Tenant, User, Location.
    - DigitalObject, DataCarrier, ScanEvent.
    - ObjectPermission + základní enforcement.
    - Resolver `/r/{public_code}`.
2. **Moduly pro MVP**
    - Product – jednoduchá produktová karta.
    - Ticketing – jednoduchý prodej vstupenek + check‑in.
    - Rental – půjčování jednoho typu věcí.
    - Shared Gallery – vytvořit galerii, upload, expirace.
    - Time \& Event – docházka (clock in/out) + jeden habit use‑case.
    - Automation – min. „open URL“ a webhook scény.
    - Contact – základní vizitka.
3. **UI**
    - Admin UI pro správu objektů, carrierů, modulů.
    - Základní analytické přehledy (počty scanů, poslední aktivity).

Tím vznikne funkční platforma, která:

- zvládá multi‑tenant a role,
- umí QR i NFC jako vstupy,
- pokrývá klíčové scénáře (retail, event, půjčování, galerie, návyky, IoT scény),
- a lze ji dál rozšiřovat podle priorit.

Pokud budeš chtít navazující detail, můžu ti připravit návrh konkrétních **API endpointů** (URI, metody, vstupy/výstupy) pro core a 1–2 moduly (například Ticketing a Rental) jako přílohu k tomuto zadání.

