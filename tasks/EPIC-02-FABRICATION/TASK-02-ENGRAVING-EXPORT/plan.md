# TASK-02-ENGRAVING-EXPORT – Plán implementace

## Kroky
1. Znovupoužít `vector.renderer.ts` (SVG matice z TASK-01)
2. `engraving.exporter.ts`:
   - SVG optimalizovaný pro gravírku (uzavřené cesty, žádné výplně přes stroke)
   - SVG → DXF přes `dxf-writer` (jednotky mm, uzavřené polyliny)
   - volitelně DXF/SVG → G-code přes CAM knihovnu
3. Aplikace `material_json` – hloubka gravírování, inverze kontrastu
4. Validace min. velikosti modulu a úrovně korekce Q+

## Testovací scénáře
- [ ] DXF se otevře v LightBurn/CAD, správné rozměry v mm
- [ ] SVG cesty jsou uzavřené (řez, ne jen obrys)
- [ ] Malý modul pod limitem → warning/zamítnutí
- [ ] Vygravírovaný QR (test na materiálu / simulace) se dekóduje

## Po dokončení
- [ ] Promítnout do `docs/reference/fabrication.md`
- [ ] Aktualizovat `PICKUP.md`
