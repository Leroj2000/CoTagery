# Fabrication & Provisioning – produkce a aktivace nosičů (AS IS)

Průřezová funkce jádra navázaná na `DataCarrier`. Negeneruje business logiku modulů, ale mění digitální nosič ve **fyzicky použitelný**. Má dvě větve:

- **A) Export výrobních souborů** (offline) – převod nosiče do souborů pro tisk štítků, gravírování (laser/CNC) a 3D tisk. Sekce 1–9.
- **B) NFC provisioning z telefonu** (interaktivní) – zápis NDEF payloadu přímo na NFC čip přes NFC hardware telefonu, přímo z naší aplikace. Sekce 10.

> Modul_type se zde nepoužívá – fabrication je nad každým `DataCarrier` bez ohledu na to, jaký modul objekt obsluhuje.

---

## 1. Princip: vektor jako zdroj pravdy

QR kód se **negeneruje jako rastr**, ale z QR matice (jednotlivé moduly) přímo do **vektorového SVG path**. Z jednoho vektorového zdroje pak plynou všechny výstupní formáty:

```
QR matice (booleovská mřížka)
        │
        ▼
   SVG (vektor)  ──►  PDF / PNG        (tisk štítků)
        │        ──►  DXF / SVG        (gravírky)
        └────────►  extruze do mesh ──►  STL / 3MF  (3D tisk)
```

Výhoda: bezeztrátové škálování, ostré hrany po gravírování, konzistence napříč médii.

---

## 2. Tři výstupní cíle a formáty

| Cíl (`target`) | Formáty (`format`) | Použití | Knihovna (Node/TS) |
|---|---|---|---|
| **label** (tisk štítků) | `pdf`, `svg`, `png`, `zpl`, `epl` | Kancelářský/inkjet tisk, archy A4 N-up, termální tiskárny (Zebra) | `pdf-lib` / `pdfkit`, `sharp`, přímé generování ZPL/EPL |
| **engraving** (gravírky) | `svg`, `dxf`, `g-code` | Laser/CNC do kovu, dřeva, plexi | nativní SVG, `dxf-writer`, CAM konverze na G-code |
| **3d** (3D tisk) | `stl`, `3mf`, `step` | Reliéfní/embosovaný QR, pouzdra na NFC inlay | `@jscad/modeling` / `three.js` (extruze), export STL/3MF |

---

## 3. Klíčová výrobní pravidla

1. **Klidová zóna (quiet zone):** min. 4 moduly kolem QR, jinak nečitelné.
2. **Minimální velikost modulu:** dle média (tisk ≥ 0,25 mm; gravírka ≥ 0,4 mm; 3D ≥ 0,8 mm) – vynucováno při renderu.
3. **Barevný profil:** tiskové PDF v **CMYK** + **bleed 3 mm** + safe-zone; screen výstupy (PNG/SVG náhled) v RGB.
4. **Rozlišení:** rastrové výstupy min. **300 DPI** (kód), 600 DPI pro malé štítky.
5. **Kontrast:** u gravírky/3D se „barva" nahrazuje hloubkou/reliéfem – vynutit inverzi tam, kde materiál nedává kontrast.
6. **Chybová korekce QR:** volitelná úroveň (L/M/Q/H); pro gravírku a 3D doporučeno ≥ Q kvůli toleranci výroby.
7. **NFC:** negeneruje se „soubor kódu"; na štítek/pouzdro se tiskne QR + textový identifikátor. 3D model může mít **kapsu na NFC inlay** (parametr `nfc_inlay_pocket`).

---

## 4. Batch / N-up

Jeden `FabricationJob` může obsahovat víc `DataCarrier` (batch). Pro `target=label` se výstupem stane **jeden PDF arch** s N-up rozložením a variabilními daty (`public_code` jako sériové číslo pod každým kódem). Manifest (`output_manifest_json`) zaznamená, který kód je na které pozici (pro archivaci a dohledatelnost).

---

## 5. Datový model

```
FabricationTemplate
  id, tenant_id
  name
  target: label | engraving | 3d
  format: pdf | svg | png | zpl | epl | dxf | g-code | stl | 3mf | step
  media_size_json    (rozměry mm, DPI, bleed, safe-zone, N-up mřížka)
  layout_json        (pozice QR, textu, loga, sériového čísla)
  material_json      (materiál, tloušťka, hloubka gravírování / extruze)
  created_at, updated_at

FabricationJob
  id, tenant_id
  template_id
  data_carrier_ids[]        (batch)
  status: queued | rendering | ready | failed
  output_file_url
  output_manifest_json
  error_message
  created_by, created_at, completed_at
```

Renderování je **asynchronní** (fronta) – STL/3D a velké batche jsou výpočetně náročné: `queued → rendering → ready | failed`.

---

## 6. API kontrakty

```
GET    /api/v1/fabrication/templates          – seznam šablon (filtr: target)
POST   /api/v1/fabrication/templates          – vytvořit šablonu
GET    /api/v1/fabrication/templates/:id
PUT    /api/v1/fabrication/templates/:id
DELETE /api/v1/fabrication/templates/:id

POST   /api/v1/fabrication/jobs               – { template_id, carrier_ids[] } → job (queued)
GET    /api/v1/fabrication/jobs/:id           – stav + output_file_url
GET    /api/v1/fabrication/jobs/:id/file      – stažení výstupního souboru
POST   /api/v1/fabrication/preview            – synchronní náhled (SVG/PNG) jednoho carrieru
```

---

## 7. RBAC

| Oprávnění | Fabrication akce |
|---|---|
| `manage` | správa šablon, mazání jobů, konfigurace materiálů |
| `edit` | vytvoření jobu, spuštění exportu |
| `view` | stažení hotových výstupů |
| `scan_only` | žádný přístup |

## 8. Multi-tenant a bezpečnost
- `FabricationTemplate` i `FabricationJob` mají povinné `tenant_id` (viz `_config/shared/tenancy_rules.md`).
- `carrier_ids[]` v jobu se validují, že patří stejnému tenantovi jako job – zabránit cross-tenant exportu.
- Výstupní soubory ukládat do per-tenant prefixu v úložišti; odkaz `output_file_url` časově omezený (signed URL).

## 9. Doporučená MVP sekvence (export souborů)
1. **label**: SVG → PDF/PNG + N-up archy (nejrychlejší hodnota)
2. **engraving**: SVG + DXF
3. **3d**: STL/3MF (nejnáročnější, extruze z matice)

---

## 10. NFC provisioning z telefonu (větev B)

Naše aplikace umí **fyzicky naprogramovat NFC čip** přímo z telefonu – bez externího HW. Uživatel přiloží tag, appka zapíše NDEF a spáruje čip s `DataCarrier`.

### 10.1 Co se zapisuje
- **NDEF URI record** = resolver URL `https://<doména>/r/{public_code}` (stejná cesta jako QR).
- Volitelně další NDEF recordy (text, AAR – Android Application Record).
- Payload musí být validován proti **kapacitě čipu** (NTAG213 ~144 B, NTAG215 ~504 B, NTAG216 ~888 B).

### 10.2 Tok programování
```
1. Vyber DataCarrier (nebo vytvoř nový nfc/hybrid nosič)
2. Přilož tag → appka přečte nfc_uid
3. Zápis NDEF (resolver URL)
4. Read-back verifikace (přečti a porovnej)
5. Volitelně LOCK / password-protect (anti-tamper)
6. Spáruj: ulož nfc_uid + status=active na DataCarrier + audit zápisu
```

### 10.3 Klíčová pravidla
1. **Platformová podpora:** Web NFC **zápis funguje jen na Androidu (Chrome)**. iOS Safari zápis přes Web NFC neumí → nativní appka / PWA-most, nebo v1 **Android-only** (viz otevřená otázka). QR je vždy fallback.
2. **Zámek tagu:** volitelně nastavit read-only / heslo po zápisu – brání přepsání cíle (anti-quishing, autenticita). Nevratné u trvalého locku – hlídat UX varováním.
3. **Read-back verifikace** je povinná – potvrdit, že se payload zapsal správně.
4. **UID capture:** `nfc_uid` se ukládá na `DataCarrier` – propojení s NFC párováním (EPIC-04).
5. **Bulk / kiosk režim:** sekvenční programování mnoha tagů za sebou (počítadlo, přeskočení chyb).
6. **Bezpečnost:** jen `manage`/`edit` na nosiči; každý zápis do **audit logu** (kdo, kdy, zařízení, UID); vše tenant-scoped.

### 10.4 Datový model (rozšíření DataCarrier / audit)
```
NfcProvisioningRecord
  id, tenant_id
  data_carrier_id
  nfc_uid
  written_payload        (NDEF, typ + hodnota)
  locked: bool
  verified: bool         (read-back OK)
  device_info_json
  written_by, written_at
```

### 10.5 API kontrakty
```
POST /api/v1/carriers/:id/nfc/provision   – zaznamenat výsledek zápisu ({ nfcUid, payload, locked, verified })
GET  /api/v1/carriers/:id/nfc/status      – stav provisioningu nosiče
```
> Samotný zápis probíhá **na klientu** (Web NFC / nativní API); backend eviduje výsledek, UID a audit. Backend nikdy „nezapisuje" fyzicky – jen řídí a loguje.

### 10.6 Doporučená MVP sekvence (provisioning)
1. Android Web NFC: zápis URL + read-back + spárování UID
2. Lock/password + bulk režim
3. iOS strategie (nativní/PWA) – dle rozhodnutí o platformě
