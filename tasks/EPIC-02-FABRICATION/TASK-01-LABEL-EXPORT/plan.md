# TASK-01-LABEL-EXPORT – Plán implementace

## Kroky
1. `qr-matrix.builder.ts` – QR matice z `public_code`/`resolver_url`, konfigurovatelná úroveň korekce + quiet zone
2. `vector.renderer.ts` – matice → SVG path (zdroj pravdy)
3. `label.exporter.ts`:
   - SVG → PDF (CMYK, bleed 3 mm) přes `pdf-lib`/`pdfkit`
   - SVG → PNG@300+DPI přes `sharp`
   - přímé generování ZPL/EPL pro termální tiskárny
4. N-up rozložení: mřížka z `media_size_json`, `public_code` pod každý kód
5. `output_manifest_json` – mapování pozice ↔ carrier
6. Napojení na `FabricationService.createJob` + async processor

## Testovací scénáře
- [ ] Jeden štítek PDF – rozměry, bleed, CMYK ověřeny
- [ ] Batch 24 kódů → jeden A4 arch, správné sériové čísla
- [ ] PNG má ≥ 300 DPI a čitelný QR (dekóduje se)
- [ ] ZPL vytiskne na Zebra emulátoru
- [ ] Cross-tenant carrier v batchi → zamítnuto

## Po dokončení
- [ ] Promítnout do `docs/reference/fabrication.md`
- [ ] Aktualizovat `PICKUP.md`
