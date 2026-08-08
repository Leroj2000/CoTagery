# EPIC-11-GALLERY – Specifikace

## Stav: 🟡 jádro hotové a ověřené (2026-08-08)

## Cíl
Sdílené galerie z akcí: upload souborů přes QR, prohlížení, retence, moderace.

## Hotovo
- [x] Entity `GalleryEvent` / `UploadItem` (tenant-scoped, RLS) + migrace InitGallery
- [x] `POST /galleries`, `GET /galleries/:id`, `POST /galleries/:id/uploads` (multipart), `GET .../uploads`
- [x] Upload binárky přes **`StoragePort`** (lokálně filesystem, prod R2 – ADR-0008)
- [x] `GalleryHandler` (module_type 'gallery') → sken vrací info galerie + počet uploadů
- [x] Ověřeno e2e: upload → soubor zapsán, list, sken handler, izolace (404)

## Follow-up
- [ ] Retence (delete_after_days) jako scheduled job; moderace (approve/reject); veřejná upload stránka (HTML)
- [ ] Signed URL ke stažení; limity velikosti/typu

## Závislosti
- EPIC-04 DIGITAL-OBJECT, EPIC-05 RESOLVER, StoragePort (EPIC-00)
