# Servisní intervaly vozidel a strojů

V **Kategoriích** lze nastavit druh údržby: běžná položka, vozidlo nebo stroj.
Položka přiřazená kategorii Vozidlo pracuje s kilometry (km), kategorie Stroj
s motohodinami (mth, s přesností na desetinu). V detailu takové položky je orientační plán servisních
prohlídek, historie odečtů a provedených prohlídek. Záznamy jsou oddělené od
obecných servisů, revizí a oprav.

## Výchozí plán

| Vozidlo | Orientační interval | Náplň |
| --- | --- | --- |
| Provozní a bezpečnostní kontrola | 10 000 km nebo 12 měsíců | Pneumatiky, brzdy, světla, kapaliny a zjevné závady. |
| Pravidelný servis | 15 000 km nebo 12 měsíců | Kontroly a výměny podle návodu daného modelu. |
| Rozšířená prohlídka | 30 000 km nebo 24 měsíců | Podrobnější kontrola pohonu, podvozku a brzd. |

| Stroj | Orientační interval | Náplň |
| --- | --- | --- |
| PM 250 | 250 mth | Základní údržba, mazání, kapaliny, úniky a bezpečnostní prvky. |
| PM 500 | 500 mth | Rozšířená údržba filtrů, hydrauliky, pohonu a opotřebení. |
| PM 1000 | 1 000 mth | Velká servisní prohlídka systémů stroje. |

Každý řádek lze **u konkrétní položky upravit**, včetně popisu a časového
limitu. Výchozí hodnoty jsou pouze příklady pro první použití, ne závazný
servisní předpis. Některé stroje mají jiný cyklus či zvláštní úvodní servis;
elektromobil zase nepotřebuje úkony určené spalovacímu motoru. Zákonné kontroly
(např. STK nebo zvláštní revize) tento plán nenahrazuje.

Základ orientačních hodnot: [Toyota – intervaly se liší podle modelu a podmínek](https://www.toyota.com/content/dam/toyota/toyota-care/toyotacare.pdf),
[Ford – běžné a náročné režimy údržby](https://fordprotect.ford.com/why-buy-a-plan),
[Caterpillar – PM1 250 h a PM2 500 h](https://www.cat.com/en_US/support/maintenance/self-service-options/planned-maintenance.html),
[John Deere – příklady cyklů 250/500/1000 h](https://manuals.deere.com/omview/OMT183331_19/CED_OUO1079_122_19_05APR00_2.htm).
Při rozdílu má vždy přednost servisní kniha a návod konkrétního výrobku.

## Výpočet a audit

- Nejprve se zapíše skutečně provedená prohlídka s datem a stavem km/mth.
  Předchozí běžné servisní záznamy bez přiřazeného intervalu se automaticky
  **nepovažují** za jeho splnění.
- Další hranice je poslední servisní stav + interval; u vozidla současně
  datum servisu + měsíce. Jakmile nastane *kterákoli* hranice, stav je
  „Po termínu“.
- „Blíží se“ znamená zbývajících nejvýše 10 % měřicího intervalu nebo 30 dní.
  Bez prvního servisního záznamu je stav „Chybí záznam“, nikoli falešně „V termínu“.
  Pokud aktuální odečet chybí, aplikace neprohlásí položku za „V termínu“;
  vyžádá si odečet. Kalendářní termín je po termínu až od následujícího dne.
- Aktuální stav měřidla se ukládá jako samostatný historický odečet. Chybný
  odečet lze smazat; technicky je označen jako smazaný pro audit a výpočet
  se vrátí k předchozímu platnému odečtu. Nižší nový stav se odmítne,
  aby nevzniklo falešné zpoždění nebo předčasné splnění. Výměna/reset
  měřidla vyžaduje budoucí zvláštní postup.
- Blížící se a prošlé intervaly i chybějící odečty se zobrazují také v
  **Vyžaduje pozornost**.

Při změně druhu kategorie se historie odečtů a servisů nemaže. Aktuálně
zobrazené výchozí řádky se ale řídí právě zvoleným druhem.
