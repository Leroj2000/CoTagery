# TASK-02-ENGRAVING-EXPORT – Zadání

## Popis
Export `DataCarrier` do souborů pro gravírky (laser/CNC): vektorové SVG a DXF, volitelně G-code. Výstup optimalizovaný pro řezání/gravírování do kovu, dřeva, plexi.

## Vstupy
- QR matice → SVG (sdíleno s TASK-01)
- `FabricationTemplate` s `target=engraving` + `material_json` (materiál, tloušťka, hloubka gravírování)

## Výstupy
- `EngravingExporter` produkující SVG (vektor) a DXF
- Volitelně G-code (přes CAM konverzi)
- Aktualizace `docs/reference/fabrication.md` při změně kontraktu

## Omezení
- Min. velikost modulu ≥ 0,4 mm (jinak nečitelné po gravírování)
- Chybová korekce QR ≥ Q kvůli toleranci výroby
- Inverze tam, kde materiál nedává kontrast (reliéf/hloubka místo barvy)
- DXF ve správných jednotkách (mm), uzavřené polyliny

## Relevantní soubory
- `src/core/fabrication/exporters/engraving.exporter.ts`
- `src/core/fabrication/vector.renderer.ts` (sdíleno)
