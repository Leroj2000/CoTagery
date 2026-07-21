# src/core/fabrication – Popis

## Co tento kód dělá
Export `DataCarrier` (QR/NFC/hybrid) do výrobních souborů pro **tisk štítků**, **gravírky** (laser/CNC) a **3D tisk**. Průřezová funkce jádra, nezávislá na `module_type`.

Specifikace: `docs/reference/fabrication.md`.

## Architektura (pipeline)
```
QrMatrixBuilder      – z public_code/resolver_url → QR matice (moduly)
  → VectorRenderer   – matice → SVG path (zdroj pravdy)
    → LabelExporter    – SVG → PDF (CMYK, bleed, N-up) / PNG@300DPI / ZPL
    → EngravingExporter– SVG → DXF / vektor SVG / (G-code volitelně)
    → MeshExporter     – SVG/matice → extruze → STL / 3MF (+ NFC pocket)
```

## Klíčové soubory (plán)
- `qr-matrix.builder.ts` – generování QR matice + quiet zone + úroveň korekce
- `vector.renderer.ts` – matice → SVG
- `exporters/label.exporter.ts` – PDF/PNG/ZPL, N-up rozložení
- `exporters/engraving.exporter.ts` – DXF/SVG
- `exporters/mesh.exporter.ts` – STL/3MF extruze
- `fabrication.service.ts` – orchestrace, validace materiálových pravidel
- `fabrication.processor.ts` – async worker (fronta jobů)
- `fabrication.controller.ts` – REST endpointy

## Exportované API
- `FabricationService.createJob(templateId, carrierIds)` → `FabricationJob`
- `FabricationService.preview(carrierId, templateId)` → SVG/PNG (synchronně)

## Kritické závislosti
- `FabricationTemplate` / `FabricationJob` dědí z `BaseTenantEntity` (povinný `tenant_id`)
- `carrier_ids` validovat proti tenantovi jobu (žádný cross-tenant export)
- Výstupy do per-tenant prefixu úložiště, `output_file_url` = signed URL s expirací
- Async fronta (BullMQ / obdoba) pro `rendering`
