# TASK-01-LABEL-EXPORT – Zadání

## Popis
Implementovat export `DataCarrier` do tiskových souborů štítků: PDF (CMYK, bleed), PNG@300+DPI, SVG a ZPL/EPL pro termální tiskárny. Podpora batch → jeden N-up PDF arch.

## Vstupy
- `DataCarrier.public_code` / `resolver_url` → QR matice
- `FabricationTemplate` s `target=label` (rozměry, DPI, bleed, N-up mřížka, layout QR+text+logo)
- Seznam `carrier_ids` pro batch

## Výstupy
- `LabelExporter` produkující PDF/PNG/SVG/ZPL
- N-up rozložení s `public_code` jako sériovým číslem pod kódem
- `output_manifest_json` (pozice ↔ kód)
- Aktualizace `docs/reference/fabrication.md` (pokud se změní kontrakt)

## Omezení
- PDF v CMYK, bleed 3 mm, safe-zone
- Min. 300 DPI pro rastr, quiet zone ≥ 4 moduly
- `carrier_ids` musí patřit tenantovi jobu

## Relevantní soubory
- `src/core/fabrication/exporters/label.exporter.ts`
- `src/core/fabrication/vector.renderer.ts`
- `src/core/fabrication/qr-matrix.builder.ts`
