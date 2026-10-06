# Tagery — produktový směr a návrh uživatelského prostředí

Verze 0.1 · 9. září 2026 · Podklad k pročtení a společnému připomínkování

## 1. Účel dokumentu

Tento dokument shrnuje dosavadní sladění produktové vize Tagery a navrženou mapu obrazovek. Odděluje potvrzené požadavky od návrhů a otevřených rozhodnutí. Popisuje cílovou zkušenost, nikoli potvrzení, že všechny uvedené funkce jsou již implementované.

V této fázi navrhujeme produkt a jeho prostředí. Programování redesignu zatím není součástí zadání. Dokument doplňuje [PRD](PRD.md); případné změny rozsahu produktu promítneme do realizační roadmapy až po sladění návrhu.

## 2. Vize a charakter Tagery

Tagery je multitenantní platforma propojující fyzické věci, lidi a místa prostřednictvím QR kódů, NFC tagů, RFID a dalších identifikátorů. Společné jádro zajišťuje identitu, oprávnění, evidenci a historii. Jednotlivé moduly přidávají vlastní pracovní postupy.

Půjčovna je jedním z modulů. Celá platforma se jí nesmí podřizovat. Mezi další scénáře patří interní předávání vybavení, inventura, servis, docházka, vstupy a klubová členství; do budoucna také marketplace předmětů a služeb.

Charakter značky: **energický a přátelský pomocník**.

Pro společnou evidenci vystihuje slib produktu věta:

> Každou věc snadno zařadíš, označíš a znovu najdeš.

Pro celou platformu je podstatné, aby fyzické načtení identifikátoru vedlo ke srozumitelné informaci a správné akci.

### Tři cílové emoce

| Emoce | Jak se má projevit |
|---|---|
| **Rychlost** | Okamžitá reakce na dotyk a načtení, minimum kroků, zachování pracovního kontextu a plynulý přechod k dalšímu úkonu. |
| **Důvěra** | Jasná organizace, konkrétní věc nebo osoba, srozumitelná oprávnění, historie kdo–kdy–co–kde a pravdivé potvrzení výsledku. |
| **Nadšení** | Příjemná vizuální odezva, kvalitní fotografie, přátelský jazyk a krátké mikrointerakce, případně zvuk či haptika podle možností zařízení. |

Okamžitá odezva a dokončení operace jsou dvě různé události. Optimistické UI může ihned ukázat změnu jako rozpracovanou, ale finální „Převzato“ nebo „Vstup povolen“ musí odpovídat potvrzenému výsledku. Chyba musí nabídnout srozumitelnou nápravu.

## 3. Potvrzené požadavky

- Zaměstnanci používají především telefon jednou rukou. Správa, inventury a reporty mají významné místo na počítači.
- Pro běžný provoz předpokládáme spolehlivé spojení. Návrh přesto musí srozumitelně zobrazit případnou chybu komunikace nebo ukládání.
- **Zařazování nové položky, její označení a přesné umístění mají stejnou váhu jako identifikace a používání zaměstnancem.**
- Místa podporují hierarchii, například město → ulice → budova → místnost → regál → úložný box.
- Současný držitel může připravit předání konkrétnímu příjemci. Příjemce potvrdí převzetí načtením identifikátoru při fyzickém přebírání.
- Zaměstnanec může také zahájit výpůjčku sám načtením vybavení; vlastník nebo oprávněná osoba půjčení schvaluje.
- Identifikátor budovy či pracoviště může zaměstnanec použít pro docházku, která sleduje pracovní dobu.
- U klubových vstupů načítá identifikátor návštěvníka **obsluha nebo samoobslužný systém**. Návštěvník si sám vlastním telefonem nenačítá kód vstupu.
- Vstupní režim potřebuje čisté průběžné snímání s jednoznačnou zelenou/červenou validací. Při úspěšné validaci vzniká záznam přítomnosti.

## 4. Společný základ a moduly

| Vrstva | Obsah |
|---|---|
| Společný základ | Organizace, účty, lidé, oprávnění, místa, identifikátory, vyhledávání a historie událostí. |
| Evidence věcí | Zařazení, fotografie, vlastnosti, umístění, držitel a interní předávání. |
| Modulové postupy | Inventury, půjčovna, servis, docházka, vstupy, členství a budoucí marketplace. |

Přesné balíčkování funkcí do modulů a jejich obchodní dostupnost tento dokument neurčuje. Podstatné je, že uživatel vidí funkce podle aktivních modulů a svých oprávnění.

Stejný identifikátor může být využit v různých pracovních režimech. Jeho význam určuje rozpoznaný objekt, aktuální úkon, organizace a oprávnění uživatele. Režim musí být před načtením jasný: sken boxu při zařazování vybere umístění, zatímco při dohledávání otevře obsah boxu.

### Pojmy, které nesmí splývat

- **Vlastník a držitel:** firma může věc vlastnit, zatímco zaměstnanec ji má u sebe. Interní předání nemusí měnit vlastnictví.
- **Předání a výpůjčka:** dlouhodobé přidělení pracovního vybavení nemusí být výpůjčkou. Půjčovna přidává vlastní podmínky, termíny a případně cenu.
- **Domovské místo a aktuální umístění:** kam věc patří a kde je právě evidovaná mohou být různé údaje.
- **Evidence a pozorování:** poslední sken s časem je informace o spatření věci; nemusí sám změnit její evidovaného držitele nebo umístění.
- **Přítomnost a pracovní doba:** vstup do budovy nemusí automaticky znamenat začátek placené práce. Pravidla určuje příslušný modul.

## 5. Návrh prostředí a navigace

Následující mapa je návrh k ověření na konkrétních obrazovkách. Jeden člověk může podle oprávnění používat více prostředí.

### 5.1 Telefon — práce v terénu

Navržená spodní navigace:

| Obrazovka | Hlavní obsah |
|---|---|
| **Dnes** | Čekající převzetí, žádosti ke schválení, úkoly a při aktivní docházce stav pracovní doby. |
| **Najít** | Vyhledávání věcí a míst, procházení skladů a jejich obsahu. |
| **Skenovat** | Načtení identifikátoru v jasně označeném pracovním kontextu. |
| **Moje** | Svěřené vybavení, vlastní žádosti a dostupné osobní přehledy. |

Správce má na „Dnes“ i v seznamu položek výrazné **Přidat položku**. Návrh musí ověřit, že zařazování je stejně snadno dosažitelné jako skenování.

Hlavní akce jsou v dosahu palce. Každá obrazovka má jednu dominantní akci a doplňující možnosti nabízí postupně. Firma a přihlášená identita zůstávají srozumitelně dostupné. Přepnutí organizace musí jasně změnit pracovní kontext.

### 5.2 Počítač — správa a přehled

| Oblast navigace | Obsah |
|---|---|
| **Přehled** | Co vyžaduje pozornost, čekající úkony a důležité změny. |
| **Položky** | Evidence, hledání, filtry, hromadné operace a zařazování. |
| **Místa** | Hierarchie firmy a obsah jednotlivých míst. |
| **Lidé** | Osoby, vztah k organizaci a svěřené vybavení. |
| **Aktivita** | Historie podle člověka, věci, místa a času. |
| **Moduly** | Aktivní inventury, půjčovna, servis, docházka, vstupy či členství. |
| **Reporty** | Přehledy a exporty dostupné konkrétní roli. |
| **Nastavení** | Organizace, účty, oprávnění, identifikátory, zařízení a integrace. |

Často používané moduly navrhujeme umožnit připnout do hlavní navigace. Technické pojmy, například digitální objekt, nemají být nutnou součástí běžného zařazování nebo hledání.

### 5.3 Terminál — odbavení vstupu

Samostatná obrazovka bez běžné administrativní navigace. Terminál je přiřazený organizaci a konkrétnímu vstupnímu místu. V klidu ukazuje výzvu „Přilož kartu nebo načti kód“ a připravenost ke snímání.

Obsluha může podle oprávnění otevřít potřebné podrobnosti a řešit výjimky. Veřejná obrazovka samoobslužného systému zobrazuje jen informace potřebné návštěvníkovi.

## 6. Hlavní pracovní postupy

### 6.1 Zařazení a označení nové položky

**Fotografie a název → identifikátor → umístění → dokončení**

1. Správce vyfotí věc a pojmenuje ji. Další údaje doplní podle typu věci a požadavků firmy.
2. Připojí existující identifikátor nebo vytvoří nový, případně vytiskne štítek.
3. Vybere přesné místo. Chybějící místo může vytvořit přímo v průvodci.
4. Uvidí potvrzení s fotografií, identifikátorem a úplnou cestou k místu.
5. Může ihned přidat další položku, případně do stejného místa.

Rozpracovaný postup má uchovat zadané údaje při návratu mezi kroky nebo opravě chyby. Přesný rozsah povinných polí ještě určíme. Zařazování bude dostupné na mobilu i počítači.

### 6.2 Hierarchie a výběr místa

Příklad úplné cesty:

> Praha → Dlouhá 12 → Budova A → Místnost 204 → Regál B → Box 07

Hierarchie nemá povinně vyžadovat všechny úrovně. Malé firmě může stačit Dílna → Skříň → Police.

Výběr má tři rovnocenné možnosti:

- **Vyhledání:** zadám „Box 07“ a rozliším výsledky podle úplné cesty.
- **Procházení:** postupně otevřu úrovně stromu.
- **Sken místa:** načtu štítek místnosti, regálu nebo boxu.

Při zadání domovského i aktuálního místa stejné hodnoty je správce vybere jednou. Pozdější přesun nesmí nepozorovaně přepsat domovské místo. GPS může doplnit souřadnice, ale nenahrazuje přesné přiřazení police nebo boxu uvnitř skladu.

### 6.3 Dohledání věci a obsah místa

Detail věci odpovídá v tomto pořadí:

1. **Co je to?** Fotografie, název a identifikační údaje.
2. **Kde ji najdu?** Evidované umístění nebo držitel, domovské místo a poslední pozorování s časem.
3. **Co mohu udělat?** Akce podle role, stavu a zapnutých modulů.
4. **Co se s ní dělo?** Srozumitelná historie.

Detail místa ukáže celou cestu, podřízená místa a uložené věci. Správce z něj může přidat položku přímo do tohoto místa nebo zahájit inventuru. U regálu může procházet boxy i hledat v celém jeho obsahu.

### 6.4 Předání připravené současným držitelem

**Příprava předání → čeká na převzetí → příjemce načte věc → potvrzené převzetí**

Současný držitel vybere předmět a příjemce. Příjemce při fyzickém přebírání načte identifikátor v režimu, který předem vysvětluje, že tím potvrzuje převzetí. Samotné běžné načtení za účelem dohledání se za souhlas nepovažuje.

Příjemce musí mít možnost ověřit věc a zaznamenaný stav, případně nahlásit problém. Způsob hlášení problému a přesný okamžik potvrzení rozpracujeme společně. Dokončení ukáže výsledek a nabídne převzetí další věci.

### 6.5 Výpůjčka zahájená zaměstnancem

**Načtení věci → žádost o půjčení → schválení oprávněnou osobou → dokončená výpůjčka**

Do schválení je žádost jasně označena jako čekající. Zůstává otevřené, zda smí zaměstnanec věc fyzicky odnést před schválením, nebo musí počkat. Toto rozhodnutí ovlivní evidenci držení a schválení; zatím není přijato.

### 6.6 Docházka zaměstnance

Přihlášený zaměstnanec načte identifikátor budovy či pracoviště ve zřejmém docházkovém kontextu. Aplikace mu ukáže, jaká událost byla zaznamenána, kde a kdy; například „Příchod zaznamenán · Budova A · 7:58“.

Osobní přehled vysvětluje, zda právě běží pracovní doba a jak zaznamenat odchod. Opakované načtení nesmí nechtěně přepnout příchod na odchod. Pravidla přestávek, odchodů a oprav ještě určíme.

### 6.7 Klubové vstupy a členství

**Načtení identifikátoru návštěvníka → ověření nároku pro daný vstup → záznam přítomnosti → výsledek**

| Stav | Zobrazení a význam |
|---|---|
| Připraveno | Výzva k přiložení karty nebo načtení kódu. |
| Probíhá ověření nebo zápis | Neutrální průběhový stav, bez předčasného potvrzení. |
| Úspěch | Zelená, symbol a „Vstup povolen“ po ověření a uložení přítomnosti. |
| Zamítnutí | Červená, symbol a stručný důvod; přítomnost nevznikne. |
| Duplicita | Srozumitelné „Už evidováno“, bez dalšího započítání stejného načtení. |
| Technická chyba | Odlišit od neplatného členství; vysvětlit další postup. |

Barva není jediným nositelem informace. Doplní ji text a symbol, případně zvuk nebo haptika podle zařízení. Po výsledku se systém automaticky připraví na dalšího návštěvníka. Pravidla opakovaného vstupu, odchodu a délky přítomnosti zůstávají k rozhodnutí.

## 7. Vizuální a interakční zásady

- Výrazná akční barva, dobře čitelná typografie a kvalitní fotografie.
- Přátelský, jednotný jazyk; konkrétní názvy úkonů místo technických termínů.
- Dostatečně velké ovládání na telefonu, hlavní akce v dosahu palce.
- Krátké mikrointerakce navázané na načtení a skutečný výsledek, které nezdržují opakovanou práci.
- Rozlišení rozpoznání identifikátoru, ověřování, ukládání a dokončení.
- Uchování pracovního kontextu, například vybraného boxu při sériovém zařazování.
- Srozumitelné prázdné, chybové a čekající stavy; možnost opravy bez zbytečného opakování práce.
- Zvuk a haptika jako doplněk, nikoli jediná odezva. Návrh počítá i s omezením animací.

Konkrétní paletu, typografii a podobu animací vybereme při návrhu obrazovek. Žádný finální vizuální styl zatím není schválený.

## 8. Návrhový itinerář

Bloky představují pořadí práce, nikoli slíbené termíny implementace.

| Blok | Předmět | Výstup |
|---|---|---|
| 1 | Produktový směr a mapa prostředí | Tento dokument, připomínky a dořešení zásadních pravidel. |
| 2 | Zařazení, označení, hierarchie míst a dohledání | Mobilní Dnes, průvodce přidáním, výběr místa, detail věci a místa. |
| 3 | Skenování, interní předání a samoobslužná žádost | Hlavní tok i chyba, duplicita, zamítnutí a čekající schválení. |
| 4 | Docházka a vstupní odbavení | Osobní docházková obrazovka a samostatný validační terminál. |
| 5 | Správcovský přehled, inventury a reporty | Desktopové obrazovky, hledání, hromadná práce a řešení rozdílů. |
| 6 | Onboarding a rozšiřující moduly | Cesta k prvnímu užitečnému výsledku a návaznost půjčovny či marketplace. |
| 7 | Designový systém a realizační plán | Sjednocené komponenty, stavy, pohyb a prioritizované implementační kroky. |

První sada obrazovek má ověřit, že **Přidat položku** a **Identifikovat** skutečně dostaly stejnou váhu. Návrhy posoudíme na konkrétních úkolech dříve, než je rozšíříme na celou platformu.

## 9. Jak budeme hodnotit návrh

Navržená měřítka; konkrétní cílové hodnoty ještě stanovíme:

- Čas a počet kroků od zahájení evidence k označené a umístěné položce.
- Rychlost zařazení další věci do stejného místa.
- Čas potřebný k nalezení konkrétního boxu nebo držitele věci.
- Odezva po načtení a samostatně čas do potvrzení uloženého výsledku.
- Podíl předání a odbavení dokončených bez pomoci.
- Srozumitelnost čekajícího schválení, chyby, duplicity a zamítnutí.
- Zda uživatel pozná organizaci, pracovní režim a důsledky svého dalšího kroku.

Požadavek na milisekundovou odezvu bereme jako směr pro okamžitou reakci rozhraní. Skutečnou rychlost načtení, validace a zápisu budeme měřit odděleně; tento návrh netvrdí, že je již ověřená.

## 10. Otevřená rozhodnutí

1. Smí zaměstnanec při samoobslužné žádosti odnést vybavení před schválením?
2. Které údaje jsou při zařazení povinné a jak se liší podle typu věci nebo nastavení firmy?
3. Jaká pravidla platí pro odmítnutí převzetí, poškozenou věc nebo nesprávného příjemce?
4. Jak se zaznamenávají odchody, přestávky a opravy docházky?
5. Jak se ukončuje přítomnost návštěvníka a jak rozlišujeme duplicitní načtení od legitimního opakovaného vstupu?
6. Jaké konkrétní čtečky a terminály budou použity a má systém také fyzicky ovládat dveře či turniket?
7. Které části navigace a moduly mají jednotlivé role vidět ve výchozím nastavení?

Tyto otázky nejsou rozhodnuté samotným zahrnutím do dokumentu. Budeme je řešit při návrhu příslušného pracovního postupu.

## 11. Stav implementace podle tohoto směru

Tato část je kontrolní dodatek k návrhu. Neznamená, že je hotový každý budoucí modul.

Implementováno v aktuálním MVP:

- mobilní pracovní navigace **Dnes / Najít / Skenovat / Moje** a rolemi a moduly filtrovaná správcovská navigace;
- rovnocenné vstupy **Přidat položku** a **Identifikovat** na přehledu;
- průvodce fotografie a názvu → identifikátor (nový, volný, vlastní nebo později) → hierarchické místo → potvrzení a přidání další věci do stejného místa;
- výběr místa vyhledáním celé cesty, procházením stromu, načtením QR štítku nebo vytvořením podmísta přímo v průvodci;
- detail místa s úplnou cestou, podřízenými místy, obsahem a stažitelným QR štítkem;
- serverové hledání věcí podle názvu, identifikačních údajů, držitele a celé cesty místa;
- read-only rozpoznání skenu oddělené od zápisu posledního pozorování, filtrování akcí podle oprávnění a ochrana opakovaného uložení registračního workflow;
- explicitní interní předání: příprava držitelem, potvrzení příjemcem načtením kódu; samoobslužná výpůjčka umožňuje odnesení před schválením a uchovává schválení odděleně;
- docházka s explicitním **Příchod / Odchod** a idempotentními výsledky; oddělená obrazovka terminálu pro obsluhu nebo samoobsluhu s výsledkem **Vstup povolen / Vstup zamítnut**;
- databázová ochrana tenantu, scope, idempotentní potvrzení a auditní záznamy pro nové operace.

Záměrně mimo tento krok zůstává marketplace, detailní pravidlový editor docházky, přestávky a fyzické ovládání dveří. Výchozí demo tenant má docházku a přístupový modul vypnutý; správce je zapíná podle oprávnění a připravenosti organizace. Pravidla opakovaného vstupu čekají na produktové potvrzení.
