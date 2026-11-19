# Plán: retence a výmaz osobních údajů (BACKLOG SEC-09)

> Stav: **jen plán – nic se nemaže**. Implementace mazání/anonymizace až po schválení Štěpánem
> (otázky na konci). Všechny migrace budou aditivní, každý mazací job nejdřív poběží jako dry-run.

## 1. Inventura osobních údajů (prod schéma, 2026-11)

| Tabulka | Osobní údaje | Čí data | Poznámka |
|---|---|---|---|
| `users` | jméno, e-mail, hash hesla | uživatelé aplikace | identita napříč firmami |
| `people` | jméno, e-mail, telefon | evidované osoby firmy (zaměstnanci, externisté) | na ně se odkazují pohyby (držba) |
| `members` | jméno, e-mail, telefon | členové (modul Členství) | |
| `renter_profiles` | e-mail, telefon | nájemci marketplace | + objednávky |
| `billing_customers` | e-mail | fakturační kontakt firmy | daňová evidence 10 let (zákon o DPH) |
| `found_reports` | `finder_contact` | nálezce (veřejný formulář) | volný text |
| `scan_events` | `ip_address`, `user_agent` | kdokoli, kdo skenuje štítek | i anonymní veřejnost |
| `asset_observations` | `actor_user_id`, adresa místa | uživatel | poloha = osobní údaj, pokud jde o osobu |
| `asset_media` | fotky (`captured_by`), mohou obsahovat obličeje/SPZ | uživatelé / třetí osoby | soubory ve storage |
| `audit_events` | `actor_user_id`, `before`/`after` JSON (může obsahovat jména, e-maily) | uživatelé | bezpečnostní účel |
| `channel_identities` | `external_id`, `display_name` (Telegram) | uživatelé | |
| `refresh_tokens` | `user_id`, hash tokenu | uživatelé | technická data |
| storage (média, doklady, manuály) | soubory | | zálohy mimo DB (INF-01) |

## 2. Navržená pravidla retence (k potvrzení)

| Data | Návrh | Způsob |
|---|---|---|
| prošlé/revokované `refresh_tokens`, reset/verify tokeny | 30 dní po expiraci | smazat (technická data) |
| `scan_events.ip_address`, `user_agent` | 90 dní | anonymizovat (IP → /24, UA → null), sken zůstává pro statistiky |
| `found_reports.finder_contact` | 90 dní po uzavření nálezu | nahradit `[anonymizováno]` |
| `audit_events` | 24 měsíců | starší pseudonymizovat (`before/after` → jen změněné klíče, bez hodnot) |
| `people` po odchodu (žádost o výmaz) | na pokyn firmy | anonymizovat: jméno → „Bývalá osoba #xxxx“, e-mail/telefon → null; **pohyby zůstávají** (integrita historie) |
| `users` (právo na výmaz) | na žádost | zrušit členství, anonymizovat jméno/e-mail, zneplatnit tokeny; audit drží jen `actor_user_id` |
| `renter_profiles` + objednávky | 3 roky od poslední objednávky | anonymizovat kontakty; účetní údaje nechat dle zákona |
| `asset_media` u vyřazených položek | firma rozhoduje (výchozí: ponechat) | volitelná retence per firma |
| zrušená firma (tenant) | 30 dní po ukončení předplatného → export + výmaz | výmaz dat firmy, zálohy doběhnou dle retence záloh (INF-01) |
| fakturační data (`billing_*`) | 10 let | nemazat (zákonná povinnost) |

## 3. Fáze implementace

- **F0 – dokumentace (bez kódu):** záznamy o činnostech zpracování, zpracovatelská smlouva (DPA) pro firmy, seznam subdodavatelů (hosting, e-mail, AI), text do zásad ochrany OÚ. Tagery je pro data firem **zpracovatel**, pro účty uživatelů **správce**.
- **F1 – dry-run report (jen čtení):** `GET /platform/retention/preview` (platform admin) a job, který jen spočítá, co by se smazalo/anonymizovalo; výsledek do logu a do platform UI. Žádná změna dat.
- **F2 – akce na žádost (ručně, s auditem):** „Anonymizovat osobu“ v detailu osoby (`core.person.delete`), „Smazat můj účet“ v profilu, export osobních údajů (`GET /auth/me/export`, JSON). Aditivní sloupce `anonymized_at` u `people`, `users`, `renter_profiles`.
- **F3 – plánované joby za feature flagem `RETENTION_ENABLED=0`:** tokeny, IP ve scan_events, kontakty nálezců, pseudonymizace auditu. Zapnutí až po schválení a po ověřené obnově ze zálohy (INF-01).
- **F4 – nastavení per firma:** retence médií, auditu a lidí v `Nastavení → Ochrana údajů`.

Každá fáze: testy nad smoke stackem (čistá DB), žádné `DROP`/`TRUNCATE`, mazání po dávkách s limitem a auditem.

## 4. Otázky na Štěpána

1. Souhlasíš s dobami v tabulce v kap. 2 (hlavně audit 24 měsíců, IP 90 dní, nájemci 3 roky)?
2. Výmaz osoby: anonymizace se zachováním historie pohybů (doporučuji), nebo úplné smazání?
3. Zrušená firma: 30 dní na export, pak výmaz – OK? Chceš automatický e-mail před výmazem (= nový zákaznický e-mail, potřebuje souhlas)?
4. Kdo zpracuje DPA a zásady (právník / šablona)?
5. Mají firmy mít retenci médií nastavitelnou, nebo stačí jedna globální?
