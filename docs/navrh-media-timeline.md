# Návrh: Časová galerie věci (condition timeline)

> Princip pro fotodokumentaci stavu věci/kontejneru v čase – aby šlo dohledat,
> jak věc vypadala při půjčení a při vrácení. Návrh, zakotvený v aktuální
> architektuře Tagery (Movement ledger, StoragePort, Gallery modul).

## 1. Klíčová myšlenka (princip)

> **Fotky nejsou vlastnost věci, ale události v jejím životě.**

Každá fotka/video je **časově orazítkovaný, nedotknutelný záznam**, který je
navázaný na okamžik – a volitelně na konkrétní **pohyb** (Movement) v ledgeru.

Protože Movement ledger už je append-only a časový, **galerie věci = média
seřazená podle času, s kotvami u půjčení / vrácení / servisu.** Rozdíl mezi
„foto při půjčení" a „foto při vrácení" je pak **důkaz o změně stavu** (poškození).

To je stejná filozofie jako u pohybů: *needituje se, přidává se.* Média jsou
tak důvěryhodný auditní doklad (spory o kauci, odpovědnost za nářadí).

## 2. Proč to dává smysl (a odlišuje nás)

- **Reálná bolest:** u půjčoven, nářadí a odpovědnosti je „v jakém stavu se to
  předalo/vrátilo" častý spor. Foto u kauce = konec dohadů.
- **Konkurence** (itemit/EZO/Timly) fotky má, ale **časovou stopu navázanou na
  pohyby + porovnání půjčka⇄vrácení** ne. Diferenciátor.
- **Napojení na to, co máme:** ledger dává časovou osu zdarma; StoragePort
  (R2/S3) úložiště; webhooky (`media.added`) automatizaci.

## 3. Datový model

Nová entita **`AssetMedia`** (append-only, jako Movement):

| Pole | Význam |
|---|---|
| `asset_id` | ke které věci/kontejneru patří |
| `movement_id` (nullable) | který pohyb dokumentuje (loan/return/handover/service) |
| `issue_id` (nullable) | nebo které hlášení problému dokládá |
| `phase` | `at_loan` / `at_return` / `at_service` / `general` – sémantická kotva |
| `kind` | `photo` / `video` / `document` |
| `file_key` + `mime` | odkaz do StoragePort |
| `caption` | volitelný popis |
| `sha256` | otisk souboru → **tamper-evidence** (doklad neupravenosti) |
| `captured_at` | kdy foto reprezentuje (default = teď) |
| `captured_by` | kdo pořídil (user/person) |
| `hidden` | „smazání" = skrytí, ne fyzické odstranění (audit) |

Klíč: **médium se váže na pohyb.** Tím vzniká trasovatelnost „takhle to vypadalo,
když si to bral Jan (loan) … takhle při vrácení (return)".

`asset.photoKey` (dnešní cover foto) se stane jen „poslední general médium" –
model se tím zobecní, nic se neztratí.

## 4. Workflow pořízení

1. **Při pohybu (loan/return/handover/service):** UI po provedení akce volitelně
   nabídne „Přidat foto stavu" → média dostanou `movement_id` + `phase`
   (`at_loan` u půjčení, `at_return` u vrácení). Politika tenanta může foto
   u vrácení **vyžadovat** (jako u potvrzení převzetí).
2. **Kdykoliv:** samostatné general foto (`captured_at` lze zadat zpětně).
3. **U hlášení problému:** foto s `issue_id` (fotka poškození).

## 5. Zobrazení

- **Časová osa věci** (na detailu): média chronologicky, seskupená pod událostmi
  ledgeru. Každý řádek pohybu ukáže své náhledy.
- **Porovnání půjčka ⇄ vrácení:** vedle sebe poslední `at_loan` a `at_return`
  z téhož loan cyklu → okamžité posouzení, co se změnilo.
- **Veřejně (volitelně):** u self-aktivace / karty lze ukázat „jak vypadala nová".

## 6. Kontejnery (věc ve věci)

- Kontejner (dodávka/kufr) má **vlastní časovou osu** stejně jako běžná věc.
- Při **výdeji celého kontejneru** lze pořídit „loadout foto" (co bylo uvnitř).
- Obsažené věci mají své vlastní osy; volitelně agregace „obsah dodávky při výdeji"
  = snapshot médií dětí v čase pohybu kontejneru.

## 7. Integrita a náklady

- **Append-only + `sha256` + `captured_by`/`captured_at`** → věrohodný doklad.
- Reuse **StoragePort** (lokálně FS, prod R2/S3 – ADR-0008); náhledy (thumbnaily).
- **Náklady/limit:** fotky rostou; per-tenant kvóta úložiště jako **metered
  billing** funkce (napojení na `PlatformUsageMeter`, který už máme).
- Webhook `media.added` pro automatizace (n8n: „při vrácení bez fotky upozorni").

## 8. MVP vs. později

**MVP:**
- `AssetMedia` (asset+movement+phase+file+sha256+captured_at).
- Upload endpointy (reuse gallery/StoragePort vzoru) + BFF proxy náhledů (jako QR/foto).
- Časová osa na detailu věci + volitelný upload v loan/return akci.
- Pohled **Porovnání půjčka ⇄ vrácení**.

**Později:**
- Video, container loadout snapshot, veřejná „jak vypadala nová".
- Politika tenanta „foto při vrácení povinné", per-tenant storage kvóta (billing).
- Ověření `sha256` v UI (odznak „neupraveno"), podpis médií.

## 9. Shrnutí jednou větou

> Připoj média jako **nedotknutelné události k ledgeru** (ne jako pole věci) –
> a časová galerie i porovnání „při půjčení vs. při vrácení" vzniknou přirozeně
> nad tím, co už máme.
