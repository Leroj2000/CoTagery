# MyTagie – UI/UX analýza itemit a Shelf

**Datum:** 17. 8. 2026  
**Rozsah:** 18 vizuálních referencí: 8× itemit + 10× Shelf  
**Účel:** převést konkrétní obrazovky a workflow konkurence do návrhových pravidel pro MyTagie.

> Poznámka k podkladům: u **Shelfu** jde ve všech 10 případech o screenshoty skutečného rozhraní z oficiální dokumentace. U **itemit** jsou první obrazovky založené na skutečném UI / oficiálních Google Play screenshotech; poslední dvě (`07`, `08`) jsou výslovně označené jako **oficiální produktové vizualizace workflow**, nikoli čistý raw screenshot aplikace. Nechci je vydávat za něco, čím nejsou.

---

# 1. Hlavní závěr před detailním rozborem

Po srovnání itemit, Shelf a dříve analyzovaného Hilti ON!Track vychází tři odlišné silné stránky:

- **Hilti ON!Track:** nejrobustnější logika Assignment / Transfer / Inventory reality.
- **Shelf:** nejčistší provozní workflow pro custody, booking, batch scan a audit.
- **itemit:** velmi dobře komunikuje univerzální asset profil, scan, last-seen lokaci, collections a kombinaci mobilu/webu.

Pro MyTagie bych proto formuloval návrhovou zásadu:

> **Datová robustnost Hilti + provozní jednoduchost Shelf + univerzálnost itemit, ale s ještě důslednějším Scan-first UX.**

Nejdůležitější není kopírovat vzhled. Je potřeba převzít dobré **informační priority, transakční model a fyzické workflow**.

---

# 2. itemit – 8 klíčových vizuálních referencí

## 2.1 Asset Profile – web + mobil

**Soubor:** `itemit/01_asset_profile_web_mobile.png`  
**Typ podkladu:** skutečné UI v oficiální produktové prezentaci  
**Zdroj:** https://itemit.com/features/

### Co obrazovka řeší

Jeden asset je „single source of truth“. V profilu jsou vedle sebe:

- fotografie;
- název a popis;
- assignee;
- Collections;
- Issues;
- Reminders;
- Information;
- Location;
- rychlé akce typu Check out / Book item.

Mobilní profil používá stejnou informační strukturu jako web.

### Co je dobré

**1. Asset je skutečně centrem aplikace.**  
Uživatel nemusí hledat informace v oddělených modulech.

**2. Sekce jsou modulární.**  
Issues, Reminders nebo Information mohou růst, aniž by bylo nutné měnit základ profilu.

**3. Rychlé provozní akce jsou blízko identity věci.**

### Kritický pohled

Profil kombinuje administrativní, servisní i provozní informace se stejnou vizuální váhou. Pro člověka, který právě stojí ve skladu s vrtačkou v ruce, jsou `Collections`, `Information` nebo `Reminders` méně důležité než:

- kdo ji má;
- kde je;
- zda je dostupná;
- co s ní teď můžu udělat.

### Návrh pro MyTagie

Horní část Asset Detail musí mít neměnnou provozní hierarchii:

```text
[FOTO] Makita DDF486

DOSTUPNÁ

Patří do:   Sklad Praha
Aktuálně:   Sklad Praha
Má ji:      —
Vrátit do:  —

[PŘEDAT]
```

Až pod tím:

```text
Informace
Historie
Dokumenty
Servis
Tagy
```

**Doporučení:** převzít modularitu itemit, ale změnit pořadí priorit.

---

## 2.2 Mobilní seznam Items

**Soubor:** `itemit/02_items_list_mobile.png`  
**Typ podkladu:** oficiální screenshot Google Play  
**Zdroj:** https://play.google.com/store/apps/details?id=com.redbite.itemit

### Co obrazovka řeší

Mobilní seznam majetku:

- item card;
- fotografie;
- název;
- stručný popis;
- barevné indikátory;
- lokace / poslední záznam;
- horní rychlé akce.

### Co je dobré

Karta je vizuálně rozpoznatelná a fotografie pomáhá při práci s fyzickým majetkem.

### Kritický pohled

Asset card může snadno přerůst ve zmenšený detail. Při stovkách věcí pak obrazovka obsahuje příliš mnoho textu.

### Návrh pro MyTagie

Výchozí mobilní karta:

```text
[foto] Makita DDF486
       Dostupná
       Sklad Praha
```

Pokud má člověk věc:

```text
[foto] Hilti TE 30
       Jan Novák
       Stavba Letiště
       Vrátit zítra
```

Tedy maximálně **3 provozní řádky**.

Vyhledávání musí být globální přes:

- název;
- výrobce/model;
- serial;
- inventární číslo;
- QR/NFC ID;
- osobu;
- lokaci.

---

## 2.3 QR Scan – okamžitá identifikace

**Soubor:** `itemit/03_qr_scan_mobile.png`  
**Typ podkladu:** oficiální screenshot Google Play  
**Zdroj:** https://play.google.com/store/apps/details?id=com.redbite.itemit  
**Doplňující dokumentace:** https://help.itemit.com/en/articles/274266-how-do-i-tag-my-assets

### Co obrazovka řeší

Telefon skenuje QR a okamžitě identifikuje asset. itemit používá Scan jako důležitý vstup a při scanu může aktualizovat `last seen`.

### Co je dobré

**Scan je fyzický most mezi štítkem a digitálním záznamem.**

Uživatel nemusí:

1. otevřít seznam;
2. hledat;
3. zadat serial;
4. otevřít detail.

### Kritický pohled

Samotná identifikace ještě neřeší, **co uživatel chce udělat potom**.

To je přesně prostor, ve kterém může být MyTagie lepší.

### Návrh pro MyTagie

SCAN není pouze scanner.

Je to **router workflow**:

```text
SCAN
  ↓
IDENTIFY
  ↓
CONTEXT
  ↓
ACTION
```

Příklad:

```text
Makita DDF486
Dostupná • Sklad Praha

[PŘEDAT]
Přesunout
Nahlásit problém
Detail
```

Jestli ji má uživatel:

```text
Makita DDF486
Máš ji od pondělí

[VRÁTIT]
Předat dál
Prodloužit
Nahlásit problém
```

---

## 2.4 Collections – organizace věcí

**Soubor:** `itemit/04_collections_mobile.png`  
**Typ podkladu:** oficiální screenshot Google Play  
**Zdroj:** https://play.google.com/store/apps/details?id=com.redbite.itemit

### Co obrazovka řeší

Collections umožňují seskupovat věci například:

```text
IT Assets
└── Laptops
```

### Co je dobré

Uživatel nemusí spoléhat jen na jednu plochou kategorii.

### Kritický pohled

Collections, Categories, Locations a Tags se u asset systémů snadno překrývají. Pokud uživatel neví, jestli má vytvořit:

- Collection;
- Location;
- Tag;
- Category;

vzniká administrativní chaos.

### Návrh pro MyTagie

Jasně oddělit význam:

**Kategorie** = co to je  
`Nářadí → Aku nářadí → Vrtačky`

**Místo** = kde to patří / kde je  
`Praha → Sklad → Regál A`

**Tag** = volný filtr  
`projekt-2026`, `kritické`, `leasing`

**Kit/Container** = fyzická skupina věcí  
`Kufr elektrikáře 03`

V MVP bych vůbec nepoužíval obecný pojem **Collection**, pokud nebude mít jednoznačný use-case.

---

## 2.5 Bookings – kdo bude věc používat

**Soubor:** `itemit/05_bookings_mobile.png`  
**Typ podkladu:** oficiální screenshot Google Play  
**Zdroj:** https://play.google.com/store/apps/details?id=com.redbite.itemit

### Co obrazovka řeší

Mobilní přehled bookingů zobrazuje:

- status;
- období;
- booked for;
- počet věcí;
- checkout stav;
- poznámky.

### Co je dobré

Rezervace a skutečné fyzické předání jsou oddělené koncepty.

To je důležité:

> **Reservation ≠ Custody.**

Věc může být rezervovaná na zítřek, ale dnes je stále fyzicky ve skladu.

### Kritický pohled

Booking je relativně komplexní entita a není vhodné ho nacpat do MVP jen proto, že ho mají konkurenti.

### Návrh pro MyTagie

Phase 2:

```text
REZERVACE
Od
Do
Pro koho
Pro jaké místo/projekt
Co / kolik
```

A samostatně:

```text
CHECKOUT / PŘEDÁNÍ
```

Při začátku rezervace lze nabídnout:

> Rezervace začíná. Chceš vydat připravené věci?

---

## 2.6 Mapa / Last Seen

**Soubor:** `itemit/06_map_last_seen_mobile.png`  
**Typ podkladu:** skutečné UI na zařízení v oficiálním produktovém podkladu  
**Zdroj:** https://itemit.com/  
**Doplňující dokumentace:** https://help.itemit.com/en/articles/82919-can-i-track-the-location-of-my-assets

### Co obrazovka řeší

Mapa zobrazuje assety a jejich lokaci / last seen.

### Co je dobré

Pro distribuované firmy je mapa intuitivnější než tabulka.

### Největší UX riziko

Musí být naprosto jasné, co pin znamená.

Existují minimálně tři různé pravdy:

1. **evidované přiřazení** – kam jsme věc účetně/provozně předali;
2. **poslední scan** – kde ji někdo naposledy skenoval;
3. **live GPS/BLE observation** – kde ji senzor skutečně zaznamenal.

Pokud aplikace tyto vrstvy vizuálně sloučí, uživatel získá falešný pocit přesnosti.

### Návrh pro MyTagie

Detail:

```text
EVIDENCE
Jan Novák • Stavba Letiště

POSLEDNÍ DETEKCE
Sklad Praha
17. 8. 2026 14:32
Zdroj: QR scan / Petr
```

Mapu prezentovat primárně jako **Observation Map**, nikoli jako absolutní „aktuální poloha“, pokud nemáme live tracking.

---

## 2.7 Audit – vizuální reference workflow

**Soubor:** `itemit/07_audit_visual_reference.png`  
**Typ podkladu:** **oficiální produktová vizualizace, nikoli raw screenshot**  
**Zdroj:** https://itemit.com/  
**Dokumentace workflow:** https://help.itemit.com/en/articles/597160-audit-feature-documentation

### Co itemit skutečně řeší

Mobilní audit pracuje nad Location nebo Collection a využívá QR scan. Dokumentace popisuje:

- `Scan Due`;
- `Found`;
- správně nalezenou věc;
- neznámý tag;
- `New item discovered`;
- možnost přesunout nečekaně nalezenou věc do kontrolovaného místa.

### Co je dobré

itemit velmi prakticky používá scan jako způsob potvrzení fyzické přítomnosti.

### Kritický pohled

Jeho auditní model je výrazně spojený s `Last Seen` časem. To je elegantní, ale technická implementace může být uživateli méně průhledná.

### Návrh pro MyTagie

Inventurní session musí mít vlastní explicitní stav:

```text
Očekáváno: 154

Nalezeno: 147
Chybí:       7
Navíc:       3
```

Scan je událost v konkrétní `InventorySession`, ne pouze aktualizace obecného `last_seen`.

To nám dá čistší audit a lepší reportovatelnost.

---

## 2.8 Issues – vizuální reference workflow

**Soubor:** `itemit/08_issue_visual_reference.png`  
**Typ podkladu:** **oficiální produktová vizualizace, nikoli raw screenshot**  
**Zdroj:** https://itemit.com/  
**Dokumentace:** https://help.itemit.com/en/articles/274978-how-do-i-report-an-issue-on-one-of-my-items

### Co obrazovka/workflow řeší

Issue je připojené k assetu a má:

- popis;
- prioritu;
- případnou přílohu;
- historii;
- stav.

itemit navíc umožňuje reportovat issue přes Public Profile.

### Co je dobré

Problém je vždy připojený ke konkrétní fyzické věci.

### Kritický pohled

Samostatný modul „Issues“ je užitečný pro správce, ale pracovník v terénu by neměl muset přemýšlet o ticketing systému.

### Návrh pro MyTagie

Po scanu:

**Nahlásit problém**

Formulář:

```text
[foto]
Co je špatně?
[ text ]

Závažnost
○ běžná
○ omezuje použití
○ nelze používat

[ODESLAT]
```

Backend vytvoří `Issue`, ale uživatel nemusí znát tento pojem.

---

# 3. Shelf – 10 klíčových obrazovek

## 3.1 Booking Index

**Soubor:** `shelf/01_booking_index.png`  
**Typ podkladu:** screenshot skutečného rozhraní  
**Zdroj:** https://www.shelf.nu/knowledge-base/how-to-create-a-booking

### Co obrazovka řeší

Tabulka bookingů:

- název;
- stav;
- od–do;
- custodian.

### Co je dobré

Je okamžitě vidět:

> co je rezervované, kdy a pro koho.

Stavy jsou v tabulce dostatečně stručné.

### Kritický pohled

Pro větší provoz bude tabulka potřebovat velmi dobré:

- filtrování;
- kalendář;
- konflikt view;
- uložené pohledy.

### Návrh pro MyTagie

Web Booking Index až Phase 2.

Výchozí pohledy:

```text
Dnes
Čeká na výdej
Aktivní
Po termínu
Budoucí
```

Ne jen generická tabulka.

---

## 3.2 Create Booking / Booking Detail

**Soubor:** `shelf/02_booking_detail.png`  
**Typ podkladu:** screenshot skutečného rozhraní  
**Zdroj:** https://www.shelf.nu/knowledge-base/how-to-create-a-booking

### Co obrazovka řeší

Shelf požaduje:

1. Name;
2. Booking period;
3. Custodian;
4. teprve potom assets.

Toto pořadí je logické, protože dostupnost assetu lze zkontrolovat až proti času.

### Co je velmi dobré

**Časový kontext se vytvoří před výběrem assetů.**

Díky tomu následný asset selector může automaticky skrýt / označit konfliktní kusy.

### Návrh pro MyTagie

Stejný princip:

```text
Nová rezervace

Kdo:
Kdy od:
Kdy do:
Kam / projekt:

→ Přidat věci
```

Při výběru assetů už systém zná požadované období.

---

## 3.3 Asset Selector v bookingu

**Soubor:** `shelf/03_booking_asset_selector.png`  
**Typ podkladu:** screenshot skutečného rozhraní  
**Zdroj:** https://www.shelf.nu/knowledge-base/adding-assets-and-kits-to-a-booking

### Co obrazovka řeší

Modal pro přidávání:

- search;
- filtry;
- list assets;
- výběr více věcí;
- možnost skrýt nedostupné.

### Co je dobré

Batch selection je vhodný pro web.

### Kritický pohled

Ve skladu je klikání checkboxů pomalejší než fyzický scan.

### Návrh pro MyTagie

Stejná rezervace má dva vstupy:

**Web**
`Vybrat ze seznamu`

**Mobil**
`Scan to Add`

Při fyzickém výdeji je Scan to Add primární.

---

## 3.4 Batch Scanner Actions

**Soubor:** `shelf/04_batch_scanner_actions.png`  
**Typ podkladu:** screenshot skutečného mobilního rozhraní  
**Zdroj:** https://www.shelf.nu/knowledge-base/batch-scanning-actions

### Co obrazovka řeší

Scanner má Action selector:

- View asset;
- Assign custody;
- Release custody;
- Update location.

Při batch režimu lze rychle skenovat více věcí, vidět počet a řešit blockers před potvrzením.

### Co je výborné

Tohle je jeden z nejsilnějších konkurentních UX vzorů.

Shelf řeší:

```text
zvol akci
→ rychle skenuj N věcí
→ zkontroluj seznam
→ potvrď jednou
```

A před transakcí řeší konflikty.

### Kritický pohled

Pro běžného uživatele stále začínáme volbou systémového pojmu „Assign custody“.

### Návrh pro MyTagie

Použít lidský jazyk:

```text
Co děláš?

○ Vydávám věci
○ Vracím věci
○ Přesouvám věci
○ Inventarizuji
```

Potom:

```text
VÝDEJ PRO: Jan Novák

[SCAN]

8 věcí naskenováno

1 problém:
Bosch GSH – právě ji má Petr

[Vyřešit]

[PŘEDAT 7 VĚCÍ]
```

**Toto bych dal už do MVP.**

---

## 3.5 Give Custody

**Soubor:** `shelf/05_assign_custody.png`  
**Typ podkladu:** screenshot skutečného rozhraní  
**Zdroj:** https://www.shelf.nu/knowledge-base/custody-feature-for-long-term-equipment-lend-outs

### Co obrazovka řeší

Z assetu lze provést:

`Actions → Give custody`

Custody je podle Shelfu v zásadě výpůjčka bez povinného termínu vrácení.

### Co je dobré

Shelf dobře odděluje:

- **custody** = kdo věc dlouhodobě drží;
- **booking** = kdo ji má mít v konkrétním časovém intervalu.

### Kritický pohled

Pojem Custody je produktově přesný, ale pro běžné české UI není přirozený.

### Návrh pro MyTagie

Jedna akce:

**PŘEDAT**

Pokud není `return_at`:

→ dlouhodobé přidělení.

Pokud je `return_at`:

→ výpůjčka.

Backend může mít odlišné subtype, ale uživatel nemusí vybírat mezi „Assign“ a „Loan“.

---

## 3.6 Release Custody

**Soubor:** `shelf/06_release_custody.png`  
**Typ podkladu:** screenshot skutečného rozhraní  
**Zdroj:** https://www.shelf.nu/knowledge-base/custody-feature-for-long-term-equipment-lend-outs

### Co obrazovka řeší

Symetrická operace k předání:

`Release custody`

Po vrácení se asset opět stává Available.

### Co je dobré

Workflow má jasný začátek i konec.

### Návrh pro MyTagie

Pokud scanner identifikuje asset, který má aktuální uživatel:

primární CTA není obecné **Předat**, ale:

# VRÁTIT

Systém se kontextově přizpůsobí aktuálnímu assignmentu.

---

## 3.7 Asset Overview

**Soubor:** `shelf/07_asset_overview.png`  
**Typ podkladu:** screenshot skutečného rozhraní  
**Zdroj:** https://www.shelf.nu/features/asset-pages

### Co obrazovka řeší

Shelf Asset Page obsahuje:

- ID;
- category;
- location;
- description;
- tags;
- value;
- barcodes;
- QR;
- availability;
- reminders;
- custody;
- tabs Overview / Activity / Bookings / Reminders.

### Co je výborné

**1. Status dostupnosti je viditelný nahoře.**  
**2. Custody má vlastní viditelný blok.**  
**3. QR je součást profilu.**  
**4. Historie je samostatný tab, ne nekonečný seznam uvnitř overview.**

### Kritický pohled

Pro MyTagie je pořád příliš mnoho polí v prvním pohledu.

### Návrh pro MyTagie Web Detail

Dvouúrovňově:

### Quick panel

```text
Makita DDF486
Dostupná

Kde je: Sklad Praha
Kdo má: —
Patří do: Sklad Praha

[Předat]
```

### Full detail tabs

```text
Přehled
Historie
Rezervace
Servis
Dokumenty
```

---

## 3.8 Audit Sessions List

**Soubor:** `shelf/08_audit_sessions.png`  
**Typ podkladu:** screenshot skutečného rozhraní  
**Zdroj:** https://www.shelf.nu/features/audits

### Co obrazovka řeší

Inventura není jednorázová změna assetu, ale vlastní **Audit Session**:

- Name;
- Status;
- Description;
- Created by;
- Assignee;
- Due date.

### Co je velmi důležité pro MyTagie

Toto je lepší model než pouze:

> sken změnil `last_seen`.

Inventura je auditovatelná událost se scope, začátkem a výsledkem.

### Návrh pro MyTagie

Entita:

```text
InventorySession
- id
- organization_id
- scope_type
- scope_id
- created_by
- assigned_to
- started_at
- completed_at
- status
```

A snapshot očekávaných věcí v okamžiku zahájení.

---

## 3.9 Audit Overview – Expected / Found / Missing / Unexpected

**Soubor:** `shelf/09_audit_overview.png`  
**Typ podkladu:** screenshot skutečného rozhraní  
**Zdroj:** https://www.shelf.nu/knowledge-base/run-your-first-audit

### Co obrazovka řeší

Shelf explicitně ukazuje:

- Expected;
- Found;
- Missing;
- Unexpected.

To je velmi podobné Hilti Smart Inventory.

### Co je výborné

Uživatel okamžitě rozumí rozdílu:

> co databáze očekávala vs. co fyzicky našel.

### Doporučení pro MyTagie

Tento princip prakticky převzít.

Česky:

```text
Očekáváno 154
Nalezeno  147
Chybí        7
Navíc        3
```

Kliknutí na každé číslo otevře filtrovaný seznam.

### Důležité business rule

**Unexpected scan nesmí automaticky změnit odpovědnost nebo lokaci bez transparentního pravidla.**

Nejdřív:

> Bosch GSH je vedena u Jana Nováka, ale byla nalezena ve skladu. Přesunout evidenci sem?

---

## 3.10 Audit Scan

**Soubor:** `shelf/10_audit_scan.png`  
**Typ podkladu:** screenshot skutečného rozhraní  
**Zdroj:** https://www.shelf.nu/knowledge-base/run-your-first-audit

### Co obrazovka řeší

Dedikovaná inventurní scanner page:

- scanner / camera;
- průběžný progress;
- asset list;
- Expected/Pending stav;
- comment;
- image;
- Complete Audit.

### Co je výborné

**Scanner je optimalizovaný pro jednu konkrétní činnost.**

To je důležitá nuance proti našemu pravidlu „jeden globální Scan“:

- globální **SCAN** je nejlepší vstup k jedné věci;
- při hromadné operaci je lepší **specializovaný continuous scanner mode**.

### Doporučení pro MyTagie

Mít dva režimy:

**A. Global Scan**
```text
SCAN → věc → kontextová akce
```

**B. Workflow Scanner**
```text
Inventura / Výdej / Vrácení / Přesun
→ continuous scan
→ seznam
→ jedno potvrzení
```

Toto je jeden z nejdůležitějších závěrů celé analýzy.

---

# 4. Co bych převzal z itemit

## 4.1 Asset jako univerzální digitální profil

MyTagie nesmí být „databáze výpůjček“.

Každá věc má digitální identitu s:

- informacemi;
- tagy;
- historií;
- polohou;
- issues;
- servisem;
- dokumenty.

## 4.2 Person / Contact bez loginu

itemit ve své dokumentaci rozlišuje **User** a **Contact**. Contact může mít přiřazené assets, ale nemá login.

Pro MyTagie je toto důležitá validace:

```text
Person
   └── optional UserAccount
```

nikoli:

```text
User = každý člověk v systému
```

## 4.3 Last Seen jako samostatná informace

Ale nikdy ji nesmí směšovat s aktuálním assignmentem.

## 4.4 Public Profile

itemit umožňuje externímu člověku scanout QR a nahlásit issue bez plného přístupu do systému.

MyTagie by měla tento princip rozšířit na:

**Nahlásit nález**.

---

# 5. Co bych převzal ze Shelfu

## 5.1 Custody jako nezávislý koncept od Booking

To je velmi dobrý datový princip:

```text
Booking = plán
Custody = fyzická odpovědnost
```

## 5.2 Batch Scanner

Povinně do návrhu MyTagie.

Je extrémně relevantní pro:

- sklad;
- stavebnictví;
- AV půjčovny;
- eventy;
- IT onboarding/offboarding.

## 5.3 InventorySession

Inventura má být vlastní auditní proces, ne jen množina scanů.

## 5.4 Blockers před potvrzením transakce

Příklad:

> 8 věcí naskenováno  
> 2 nelze předat

Uživatel musí vědět **proč** a dostat návrh řešení.

## 5.5 Kit jako fyzická skupina

Kufr / sada / flightcase / box musí být skenovatelný objekt s vlastní identitou.

---

# 6. Co bych naopak nekopíroval

## 6.1 Nepoužívat v UI příliš mnoho technických pojmů

Nedoporučuji v českém základním UI:

- custody;
- assignment;
- transfer cart;
- collection;
- allocation.

Používat:

- **Věc**
- **Člověk**
- **Místo**
- **Předat**
- **Vrátit**
- **Přesunout**
- **Inventura**

## 6.2 Nepřidávat Booking do MVP jen kvůli konkurenční paritě

Nejprve musí fungovat bezchybně:

```text
Asset
Tag
Scan
Person
Location
Movement
Handover
Return
Inventory
History
```

## 6.3 Neplést „stav assetu“ a „odpovědnost“

Například:

`Condition = poškozená`

není totéž jako:

`Operational status = v servisu`

a není totéž jako:

`Assignment = Jan Novák`.

Datově musí být oddělené.

---

# 7. Výsledný návrh mobilní navigace MyTagie

```text
DOMŮ
│
├── SCAN                      ← dominantní
├── Moje věci
├── Výdej / Předání
├── Inventura
└── Upozornění
```

Global Scan:

```text
SCAN
 ↓
Asset
 ↓
Kontext
 ↓
Primární akce
```

Workflow Scan:

```text
VÝDEJ
 ↓
Komu / kam
 ↓
Continuous Scan
 ↓
Blockers
 ↓
Potvrdit
```

---

# 8. Výsledný Asset Detail MyTagie

```text
┌──────────────────────────────────┐
│ [foto]  MAKITA DDF486            │
│         DOSTUPNÁ                 │
│                                  │
│ Patří do   Sklad Praha           │
│ Aktuálně   Sklad Praha           │
│ Má ji      —                     │
│ Vrátit     —                     │
│                                  │
│       [ PŘEDAT ]                 │
├──────────────────────────────────┤
│ Informace                        │
│ Historie                         │
│ Dokumenty                        │
│ Servis                           │
│ Tagy                             │
└──────────────────────────────────┘
```

Pokud je půjčená:

```text
┌──────────────────────────────────┐
│ MAKITA DDF486                    │
│ U JANA NOVÁKA                    │
│                                  │
│ Aktuálně   Stavba Letiště        │
│ Má ji      Jan Novák             │
│ Vrátit     20. 8. 2026           │
│                                  │
│       [ VRÁTIT ]                 │
│       Předat dál                 │
└──────────────────────────────────┘
```

---

# 9. Výsledný Batch Výdej MyTagie

```text
VÝDEJ

Příjemce
Jan Novák

Místo / účel
Stavba Letiště

Vrátit do
20. 8. 2026

────────────────────────

[             SCAN             ]

Naskenováno: 4

✓ Makita DDF486
✓ Bosch GSH 5
✓ Hilti PR 30-HVS
! DeWalt bruska
  Má ji Petr Novák

[ Vyřešit problém ]

────────────────────────

[ PŘEDAT 3 VĚCI ]
```

Toto workflow kombinuje nejlepší část Shelfu s jednodušší terminologií.

---

# 10. Výsledná Inventura MyTagie

```text
INVENTURA
Sklad Praha

Očekáváno    154
Nalezeno     147
Chybí          7
Navíc          3

────────────────────────

[ CONTINUOUS SCAN ]

Poslední:
✓ Makita DDF486

────────────────────────

Průběh 147 / 154

[ Zobrazit chybějící ]
[ Dokončit inventuru ]
```

Unexpected:

```text
NALEZENO NAVÍC

Bosch GSH 5

Evidence:
Má ji Jan Novák

Fyzicky nalezeno:
Sklad Praha

[PŘESUNOUT EVIDENCI SEM]
[NECHAT BEZE ZMĚNY]
```

---

# 11. Nové požadavky, které bych přidal do budoucího zadání MyTagie

1. **Global Scan a Workflow Scanner jsou dva odlišné UX režimy.**
2. `Person` musí existovat bez `UserAccount`.
3. `Booking` a `Assignment/Custody` musí být datově oddělené.
4. Inventura musí mít vlastní `InventorySession`.
5. Inventura potřebuje snapshot očekávaných assetů.
6. Batch operace musí mít pre-flight validaci a `blockers`.
7. Asset může být současně v kategorii, lokaci a kitu – tyto pojmy se nesmí zaměňovat.
8. `Home Location`, `Current Assignment` a `Last Observation` jsou tři různé informace.
9. Public QR profil má být permission-controlled surface, nikoli kopie interního detailu.
10. Public profil má podporovat minimálně **Nahlásit problém** a budoucí **Nahlásit nález**.
11. Status assetu pokud možno odvozovat z událostí, ne ručně přepisovat.
12. Každý pohyb musí vytvořit neměnnou auditní událost.

---

# 12. Priorita inspirací pro MyTagie

| Priorita | Vzor | Co převzít |
|---|---|---|
| 1 | Shelf Batch Scanner | continuous scan + batch confirm + blockers |
| 2 | Shelf Audit | InventorySession + Expected/Found/Missing/Unexpected |
| 3 | Hilti ON!Track | Assignment/Transfer business model |
| 4 | itemit Asset Profile | univerzální digitální identita věci |
| 5 | itemit User/Contact | osoba bez loginu |
| 6 | Shelf Custody vs Booking | fyzická odpovědnost ≠ plánovaná rezervace |
| 7 | itemit Public Profile | bezpečná externí interakce přes QR |
| 8 | itemit Last Seen | observation jako samostatná datová vrstva |

---

# 13. Zdroje

## itemit

- https://itemit.com/features/
- https://itemit.com/
- https://play.google.com/store/apps/details?id=com.redbite.itemit
- https://help.itemit.com/en/articles/274266-how-do-i-tag-my-assets
- https://help.itemit.com/en/articles/597160-audit-feature-documentation
- https://help.itemit.com/en/articles/274978-how-do-i-report-an-issue-on-one-of-my-items
- https://help.itemit.com/en/articles/82921-what-s-the-difference-between-a-user-and-a-contact
- https://help.itemit.com/en/articles/82919-can-i-track-the-location-of-my-assets
- https://help.itemit.com/en/articles/274977-how-do-itemit-s-public-profiles-work

## Shelf

- https://www.shelf.nu/knowledge-base/how-to-create-a-booking
- https://www.shelf.nu/knowledge-base/adding-assets-and-kits-to-a-booking
- https://www.shelf.nu/knowledge-base/batch-scanning-actions
- https://www.shelf.nu/knowledge-base/custody-feature-for-long-term-equipment-lend-outs
- https://www.shelf.nu/features/asset-pages
- https://www.shelf.nu/features/audits
- https://www.shelf.nu/knowledge-base/run-your-first-audit
- https://www.shelf.nu/knowledge-base/scanning-an-asset

---

# 14. Doporučený další krok

Z tohoto dokumentu už lze přímo vytvořit **MyTagie UX Specification v1**.

Doporučené pořadí wireframů:

```text
01 Home
02 Global Scan
03 Asset Detail – available
04 Asset Detail – assigned
05 Předat jednu věc
06 Vrátit jednu věc
07 Batch Výdej
08 Batch Vrácení
09 Inventura – start
10 Inventura – continuous scan
11 Inventura – výsledky
12 Unexpected asset dialog
13 Lidé
14 Místa
15 Historie pohybů
16 Upozornění
```

Teprve po tomto core bych kreslil:

```text
17 Booking
18 Servis
19 Public Profile
20 Admin / Role & Permissions
```
