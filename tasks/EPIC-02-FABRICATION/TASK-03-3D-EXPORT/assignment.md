# TASK-03-3D-EXPORT – Zadání

## Popis
Export `DataCarrier` do 3D modelů pro tisk: STL a 3MF s reliéfním/embosovaným QR. Volitelně kapsa na NFC inlay pro hybridní tagy.

## Vstupy
- QR matice → extruze do 3D mesh
- `FabricationTemplate` s `target=3d` + `material_json` (tloušťka podložky, výška extruze, `nfc_inlay_pocket`)

## Výstupy
- `MeshExporter` produkující STL a 3MF
- Model: podložka + vystouplé/zapuštěné moduly QR
- Volitelná kapsa na NFC inlay (rozměry standardního tagu)
- Aktualizace `docs/reference/fabrication.md` při změně kontraktu

## Omezení
- Min. velikost modulu ≥ 0,8 mm (tolerance FDM tisku)
- Chybová korekce QR ≥ Q
- Vodotěsný (watertight) manifold mesh – jinak neslicovatelný
- Kontrast řešen výškou (emboss) nebo hloubkou (deboss), ne barvou

## Relevantní soubory
- `src/core/fabrication/exporters/mesh.exporter.ts`
- `src/core/fabrication/qr-matrix.builder.ts` (sdíleno)
