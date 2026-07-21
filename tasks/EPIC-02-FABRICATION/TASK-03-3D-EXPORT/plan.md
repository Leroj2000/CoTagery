# TASK-03-3D-EXPORT – Plán implementace

## Kroky
1. `mesh.exporter.ts` s `@jscad/modeling` (nebo `three.js`):
   - podložka (základna) z `material_json`
   - extruze QR modulů: emboss (výstupek) nebo deboss (prohlubeň)
   - volitelná kapsa na NFC inlay (`nfc_inlay_pocket`)
2. Export mesh → STL (binární) a 3MF
3. Kontrola watertight/manifold geometrie
4. Validace min. velikosti modulu 0,8 mm a korekce Q+

## Testovací scénáře
- [ ] STL se otevře ve sliceru (Cura/PrusaSlicer), je manifold
- [ ] Vytištěný/simulovaný QR se dekóduje (dostatečný kontrast reliéfu)
- [ ] NFC pocket má správné rozměry pro standardní inlay
- [ ] 3MF zachová jednotky a měřítko

## Po dokončení
- [ ] Promítnout do `docs/reference/fabrication.md`
- [ ] Aktualizovat `PICKUP.md`
