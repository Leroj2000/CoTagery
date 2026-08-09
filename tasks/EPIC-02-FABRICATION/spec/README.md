# EPIC-02-FABRICATION – Specifikace

## Stav: 🟡 MVP label export hotové a ověřené (2026-08-09)
Implementováno: `GET /carriers/:id/fabrication?format=svg|png|pdf` – tiskový štítek (QR + public_code). SVG = vektor (zdroj pravdy), PDF přes pdfkit. Ověřeno e2e (SVG s kódem, PNG, PDF `%PDF-`). Follow-up: FabricationTemplate/FabricationJob + async fronta, batch N-up, gravírka (DXF/G-code), 3D (STL/3MF), NFC provisioning (větev B).

## Cíl
Umožnit tenantům proměnit `DataCarrier` (QR/NFC/hybrid) ve fyzicky použitelný nosič – dvě větve:
- **A) Export výrobních souborů** pro tisk štítků, gravírování (laser/CNC) a 3D tisk, včetně batch N-up archů.
- **B) NFC provisioning z telefonu** – fyzický zápis NDEF na čip přímo z aplikace (Web NFC / nativní), read-back, lock, spárování UID.

Referenční dokumentace: `docs/reference/fabrication.md`.

## Scope

### In scope
- Vektorový render QR z matice (SVG jako zdroj pravdy)
- Export label: PDF (CMYK, bleed), PNG@300+DPI, SVG, ZPL/EPL
- Export engraving: SVG (vektor), DXF, volitelně G-code
- Export 3D: STL, 3MF (reliéfní/embosovaný QR, kapsa na NFC inlay)
- Šablony (`FabricationTemplate`) a joby (`FabricationJob`) s async frontou
- Batch / N-up rozložení s variabilními `public_code`
- Manifest výstupu pro dohledatelnost
- **NFC provisioning (větev B):** zápis NDEF (resolver URL) z telefonu, read-back verifikace, volitelný lock/heslo, spárování `nfc_uid`, audit (`NfcProvisioningRecord`), bulk režim

### Out of scope
- Přímé ovládání tiskáren/gravírek (jen generujeme soubory)
- Slicing pro 3D tisk (výstup je STL/3MF, slicing dělá uživatel)
- Automatický nákup/objednání štítků
- Fyzický zápis na backendu – NFC zápis běží vždy na klientu (telefon), backend jen eviduje výsledek + audit

## Acceptance kritéria
- [ ] QR se generuje vektorově (žádná ztráta kvality při zvětšení)
- [ ] Vynucena quiet zone a minimální velikost modulu podle média
- [ ] Tiskové PDF v CMYK s bleed 3 mm
- [ ] Batch export produkuje jeden N-up PDF arch se sériovými čísly
- [ ] STL model volitelně obsahuje kapsu na NFC inlay
- [ ] Job běží asynchronně (`queued → rendering → ready|failed`)
- [ ] `carrier_ids` validovány proti `tenant_id` jobu (žádný cross-tenant export)
- [ ] Výstupní soubor dostupný přes časově omezenou signed URL

## Závislosti
- Core: `DataCarrier` musí existovat (EPIC core schema)
- Úložiště souborů (S3-compatible) + CDN
- Fronta jobů (BullMQ / Redis nebo obdoba)

## Podúkoly
- [ ] TASK-01-LABEL-EXPORT – Tisk štítků (PDF/PNG/SVG/ZPL + N-up)
- [ ] TASK-02-ENGRAVING-EXPORT – Gravírky (SVG/DXF)
- [ ] TASK-03-3D-EXPORT – 3D tisk (STL/3MF + NFC pocket)
- [ ] TASK-04-NFC-PROVISIONING – zápis NDEF z telefonu (Android Web NFC), read-back, lock, spárování UID, audit, bulk režim
