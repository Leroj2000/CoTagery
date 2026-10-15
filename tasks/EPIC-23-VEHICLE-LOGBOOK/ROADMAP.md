# EPIC-23-VEHICLE-LOGBOOK – Roadmapa

Spec: [`spec/README.md`](spec/README.md) · Stav: ⬜ ZADÁNO (2026-10-15)

| Fáze | Obsah | Stav | Odhad |
|---|---|---|---|
| F1 | Jádro: `vehicle_trips`, odečty se zdrojem (`source`/`source_id`), `MeterReadingsService`, logika kontinuity + testy, API start/finish/zpětný zápis/storno, záložka Kniha jízd, oprávnění `vehicle.trip.*`, RLS a izolační testy | ⬜ | 3–4 dny |
| F2 | Mobil a tankování: rychlá jízda po skenu QR, Moje jízdy, `vehicle_fuel_entries` s účtenkou, spotřeba l/100 km, přehled Jízdy | ⬜ | 2–3 dny |
| F3 | Daňová průkaznost a vazby: měsíční souhrn, nezapsané km, uzávěrka a zamčení, export XLSX/PDF, napojení na inventuru vozidel, rezervace → jízda, zdroj `trip` v kalendáři (po merge `feature/calendar`) | ⬜ | ~3 dny |
| F4 | Rozšíření (volitelné): našeptávání tras, vzdálenost z map, telematika/OBD, akce v EPIC-22 kanálech, cestovní náhrady | ⬜ | – |

## Pořadí a závislosti
1. F1 nezávisí na kalendáři; staví na `asset_meter_readings` a modulu `vehicles`.
2. F2 po F1 (sken a „Moje vybavení" už existují).
3. F3 po F1+F2; část „kalendář" až po merge `feature/calendar` do `main`.
4. Před F3 rozhodnout otevřené otázky 3, 4 a 7 (soukromé jízdy, uzávěrka, formát exportu).
