# MyTagie – konkurenční analýza

**Datum:** 16. 8. 2026  
**Rozsah:** 9 konkurentů × 53 funkčních kritérií

## Legenda

- **✓** – funkce je ve veřejných oficiálních zdrojích jasně doložena
- **~** – částečné nebo užší řešení
- **✕** – jasně nepodporováno / produkt používá opačný model
- **?** – ve zkontrolovaných veřejných zdrojích nebylo potvrzeno

> `?` neznamená, že konkurent funkci určitě nemá.

## Sledované služby

Shelf, itemit, MapYourTag, Timly, EZO, Hilti ON!Track, STAVARIO, Správce majetku a Aptien.

## Hlavní závěry

1. **QR + evidence + checkout je commodity.** MyTagie na tom musí mít výborné UX, ale není to samo o sobě diferenciátor.
2. **Timly a EZO jsou nejsilnější šíří funkcí.** Není vhodné je v MVP dohánět počtem modulů.
3. **Shelf je klíčový UX benchmark.** Jeho QR-first custody a booking workflow je blízko požadované jednoduchosti.
4. **MapYourTag je nejbližší základnímu konceptu MyTagie.** QR/NFC, libovolné fyzické věci a hardware-agnostic přístup znamenají, že MyTagie musí vyhrát především workflow a odpovědností.
5. **Hilti ON!Track je nejlepší benchmark pro Assignment/Transfer + inventurní reconciliation.**
6. **Český trh není prázdný:** STAVARIO řeší stavební kontext, Správce majetku inventury/revize a Aptien širokou správu majetku a handovery.
7. Nejzajímavější prostor pro MyTagie je kombinace:
   - **Scan-first UX**
   - **Person ≠ User Account**
   - **Home vs Current vs Responsible**
   - **Movement Ledger**
   - **inventurní rozdíl Očekáváno / Nalezeno / Chybí / Navíc**
   - **public/no-login tag + Nahlásit nález**
   - **hardware agnostic QR/NFC/BLE/RFID**
   - **API-first architektura**

## Doporučené strategické pravidlo

> **Funkční robustnost blíž Hilti/Timly/EZO, každodenní jednoduchost blíž Shelf, univerzálnost tagů blíž MapYourTag.**

Podrobná 53×9 matice, roadmapa a zdroje jsou v přiloženém Excelu.
