# ADR-0004 – Modulární monolit teď, extrakce služeb později

- **Stav:** Přijato
- **Datum:** 2026-07-19

## Kontext
11 modulů svádí k mikroslužbám od začátku. Tým je v rané fázi, priorita je rychlost dodání MVP a nízká provozní režie. Zároveň nechceme „big ball of mud", ze kterého nejde nic vyříznout.

## Rozhodnutí
Stavíme **modulární monolit** v NestJS:
- Každý modul = samostatný NestJS `Module` s jasnou hranicí (vlastní controllers/services/entities).
- Moduly komunikují **jen přes definovaná rozhraní / doménové eventy**, ne saháním do cizích tabulek.
- Jádro (core) vystavuje kontrakty (`DigitalObject`, `DataCarrier`, resolver hook `handleScan`), moduly je implementují.
- Resolver hot path lze nasadit jako **samostatný deployment téhož kódu** (viz ADR-0002), protože je stateless.

## Extrakce později
Kandidáti na osamostatnění, až to vynutí zátěž: **Resolver**, **ScanEvent pipeline / analytika**, **Gallery média** (těžké I/O). Čistě oddělené moduly umožní extrakci bez přepisu domény.

## Důsledky
- Jeden repozitář, jedno CI, jednodušší lokální vývoj a transakce.
- Disciplína hranic modulů musí být vynucena review + lint (žádné cross-module importy entit).
- Feature-flag per modul → tenant si zapíná jen to, co používá.
