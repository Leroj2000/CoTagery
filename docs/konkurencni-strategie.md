# Konkurenční strategie: co uchopit pro Tagery

> Rozhodnutí, co z konkurenční analýzy (`docs/inspiration/Konkurence/`, 9 služeb ×
> 53 funkcí) reálně zapracovat. **Pozn.: „MyTagie" v analýze = tento projekt
> Tagery** (stejný produkt, jiný pracovní název). Zakotveno v aktuálním stavu na `main`.

## 1. Kde stojíme (překvapivě daleko)

Analýza doporučuje jádro: *scan-first custody · Person ≠ účet · Home/Current/
Responsible · Movement Ledger · inventura Nalezeno/Chybí/Navíc · public tag ·
hardware-agnostic · API-first*. **Většinu z toho už MÁME** (Fáze A–C):

| Doporučení analýzy | Priorita | Náš stav |
|---|---|---|
| Univerzální registr věcí (Asset) | MVP | ✅ Asset nad DigitalObject |
| Person ≠ účet | MVP · diferenciátor | ✅ Person (Party) |
| Home ≠ Current ≠ Responsible | MVP · diferenciátor | ✅ tři oddělené údaje |
| Movement Ledger (append-only) | MVP · parita | ✅ asset_movements |
| Scan → kontextová akce | MVP | ✅ handler vrací akce |
| Hierarchické lokace (strom) | MVP · diferenciátor | ✅ Location.parent_id |
| Kategorie | MVP | ✅ číselník + inline |
| Inventura Nalezeno/Chybí/Navíc | MVP · **diferenciátor** | ✅ inventory modul |
| Kity/kontejnery (nesting) | Phase 2 · diferenciátor | ✅ hotovo napřed |
| Rezervace / požadavky | Phase 2 | ✅ reservations |
| Potvrzení převzetí | Phase 2 · diferenciátor | ✅ movement confirmation |
| Servis + plánované revize | Phase 2 | ✅ service records + next_due |
| RBAC | MVP · parita | ✅ RolesGuard |
| REST API-first, multi-tenant | MVP · diferenciátor | ✅ |
| QR + generování/tisk + NFC | MVP | ✅ carrier QR/NFC + export |
| Veřejná no-login stránka po scanu | Phase 2 · diferenciátor | ✅ /s/{code} |

**Závěr:** funkčně jsme na úrovni MVP a části Phase 2 z matice. To je silná pozice —
konkurence (Timly/EZO/Hilti) nás předčí jen šíří enterprise funkcí, ne jádrem.

## 2. Reálné mezery (co chybí)

Seřazeno podle priority MVP a strategické hodnoty:

### 🟢 Uchopit hned (MVP, vysoká páka)

1. **Hromadný výdej „Výdej" (transfer cart)** — MVP · **diferenciátor**. Denní workflow
   skladu: příjemce → rychle naskenuj N věcí → jedno potvrzení. Máme Movement, chybí
   dávkový režim. *Konkurence: Shelf/EZO/Hilti to mají; my ne.*
2. **CSV/XLSX import & export** — MVP · commodity, ale **onboarding blocker**. Bez
   importu ze spreadsheetu zákazník nezaloží 500 věcí ručně. *Skoro všichni to mají.*
3. **Fotografie u věci** — MVP · commodity. Máme StoragePort + Gallery, jen nepropojené
   s Asset. Vizuální identifikace je základ (analýza §4).

### 🟡 Rychlé doplňky (MVP parita, malá práce)

4. **Nahlášení poškození/problému (Issue)** — MVP · parita. Scan → „Nahlásit problém" →
   foto + popis → událost. Přirozeně navazuje na Movement/Service.
5. **Inventura nad osobou / kontejnerem** — MVP · diferenciátor. Engine máme, dnes jen
   nad lokací; rozšířit „očekávané" i na holder=person / holder=asset.
6. **Action-oriented alerty + reminders** — MVP · commodity. Máme „Vyžaduje pozornost"
   (po termínu, blížící se servis); doplnit e-mail/push připomínky (potřebuje SMTP).

### 🔵 Odlišující sázky (Phase 2, málokdo je má)

7. **„Nahlásit nález" (public found report)** — Phase 2 · diferenciátor. Nálezce naskenuje
   QR bez loginu → anonymně kontaktuje vlastníka. **Málokdo to kombinuje s custody** —
   silná diferenciace (Shelf ano, většina ne). Máme veřejný scan; stačí přidat formulář.
8. **Doménové webhooky** (`movement.created`, `inventory.mismatch`, `service.due`…) —
   Phase 2 · diferenciátor. V matici to **nemá nikdo** (vše „?"). Infra pro billing
   webhooky už máme. Levná, strategická výhoda pro automatizace (n8n/Make/Zapier).
9. **Scoped access per lokace/workspace** — Phase 2 · parita. RBAC máme globální; přidat
   omezení „vedoucí skladu Praha nevidí Brno".
10. **Digitální podpis při předání** — Phase 2 · diferenciátor. Nad potvrzením převzetí.

### ⚪ Zatím nedělat (Phase 3 / mimo core)

Quantity items (spotřební materiál), RFID/BLE/GPS provider vrstva, Smart Inventory přes
gateway, AI (OCR štítku), vlastní rule engine, self-host. Datový model neblokují — přidat
až po validaci core (analýza to explicitně doporučuje: „neimitovat EZO/Timly funkcemi v MVP").

## 3. Strategické pravidlo (převzato z analýzy)

> **Funkční robustnost blíž Hilti/Timly/EZO, každodenní jednoduchost blíž Shelf,
> univerzálnost tagů blíž MapYourTag.**

Naše odlišení = **scan-first jednoduchost nad robustním custody modelem + hardware-agnostic
tagy + API/webhooky pro automatizaci.** Nesoutěžit počtem modulů.

## 4. Doporučené pořadí

**Sprint 1 (onboarding + denní provoz):** CSV import/export · Hromadný výdej · Foto u věci.
**Sprint 2 (parita + odlišení):** Issue/nahlášení problému · inventura nad osobou/kontejnerem ·
„Nahlásit nález" public.
**Sprint 3 (automatizace):** doménové webhooky · scoped access · reminders přes SMTP.

Vše nad stávajícím Asset/Movement modelem — žádné přepisy, jen rozšíření.
