# ADR-0010 – Asset je kanonický model fyzické věci
- **Stav:** Přijato
- **Datum:** 2026-09-06

## Kontext

Projekt obsahuje dva modely stejného reálného pojmu:

- `assets` je napojený na `DigitalObject`, QR/NFC identifikátory, místa, lidi,
  pohyby, inventury, média, servis, závady a veřejné `RentalListing`,
- starší `rental_items` používá interní Rental modul s vlastními `Loan` a
  `RentalReview` a obchází objektové jádro platformy.

Dvě identity jedné fyzické věci vedou k rozdílnému stavu, ceníku a historii.

## Rozhodnutí

`Asset` je jediný kanonický model fyzické položky pro Tagery Věci i všechna budoucí
rozšíření. `DigitalObject` je její digitální identita a `DataCarrier` její fyzický
identifikátor. Modulové tabulky mohou doplňovat vlastní data, ale vždy odkazují na
`assets.id` a nesmí vytvářet druhou evidenci věci.

Stávající `rental_items`, `rental_loans` a starý interní Rental API se zmrazují:

- nepřidávají se do nich nové funkce,
- nezobrazují se v novém MVP UI,
- veřejná půjčovna pokračuje přes `Asset` → `RentalListing` → `RentalOrder`,
- odstranění tabulek proběhne až po inventuře produkčních dat a případné migraci.

Pro výpůjčky je fyzický stav a držitel nadále odvozen z `Movement` ledgeru. Ceník,
publikační stav a obchodní podmínky patří do `RentalListing`; objednávka patří do
`RentalOrder`.

## Migrační plán

1. Ověřit počet a použití záznamů ve starých rental tabulkách.
2. Pro každý používaný `rental_item` vytvořit nebo přiřadit `Asset`.
3. Převést aktivní půjčky na pohyby a objednávky, pokud je nutné zachovat provozní stav.
4. Staré endpointy označit jako deprecated a zablokovat nové zápisy.
5. Po ověření historie odstranit starý modul a tabulky samostatnou reverzibilní migrací.

## Důsledky

- Jedna věc má jednu historii, stav, fotografii a sadu identifikátorů.
- Inventura, interní výdej i veřejná půjčovna používají stejné provozní jádro.
- Krátkodobě zůstává legacy kód v repozitáři, ale jeho hranice je explicitní.
- Odstranění legacy schématu není součástí M0 a nesmí proběhnout bez kontroly dat.
