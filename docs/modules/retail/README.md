# Modul: Retail (AS IS)

Retail skupina zahrnuje 5 modulů: Product, Loyalty, Payment, Inventory, Trace.

---

## 5.1 Product modul

**Use-case:** QR/NFC na obalu nebo v regálu → produktová karta (složení, původ, recenze, návody, cross-sell). Budoucí GS1 Digital Link (GTIN, šarže).

**Entity:**
```
Product
  digital_object_id
  gtin
  brand
  name
  description
  ingredients
  origin
  care_instructions
  media (obrázky, videa)
  reviews (vazba)
```

---

## 5.2 Loyalty modul

**Use-case:** QR/NFC na účtence, plakátu, stojanu → věrnostní program, sbírání bodů, kupony.

**Entity:**
```
Customer
LoyaltyAccount
PointsTransaction
Coupon
Campaign
```

---

## 5.3 Payment modul (Scan & Pay)

**Use-case:** QR na účtence / stole / pokladně → zaplatit účet (Qerko-like), Scan & Pay v retailu.

**Entity:**
```
Bill / Order
PaymentSession
PaymentMethod
Receipt
```

---

## 5.4 Inventory modul

**Use-case:** QR/NFC na boxech, ve skladu → zobrazit obsah, provést inventuru, změnit množství.

**Entity:**
```
StockItem / Container
Movement
InventorySession
```

---

## 5.5 Trace / Compliance modul

**Use-case:** QR na produktu → šarže, expirace, certifikace, recyklace, Digital Product Passport (DPP). Odpovídá EU regulaci digitálního produktového pasu.

**Entity:**
```
Batch
Certification
Recall
DppRecord
```

---

## 5.12 Membership modul (klubové / nákupní členství)

**Use-case:** Členská/klubová karta s QR nebo NFC → vstup do členských zón, slevy, služby zdarma nebo za speciální cenu. Členství má **úrovně (tiery)** a **platnost** (předplatné).

Modul je navržen jako **tenká entitlement vrstva**: sám vede identitu člena, tiery a nároky, ale **realizaci benefitů deleguje** – slevy/ceny přes **Payment**, body přes **Loyalty**, vstup do zón přes sdílený **Access Control** (`docs/reference/access-control.md`, ADR-0006).

**Entity:**
```
Member                       # perzistentní identita člena, PER-TENANT (jsi člen TÉHO klubu)
  id, tenant_id
  linked_user_id (nullable)
  display_name, email, phone
  status: active | suspended
  created_at, updated_at

MembershipTier
  id, tenant_id
  name                       # Bronze | Silver | Gold …
  price, billing_period      # měsíc / rok (předplatné)
  benefits_json              # co tier dává (viz MembershipBenefit)
  access_zones[]             # do kterých zón pouští (napojení na Access Control)

Membership                   # člen ↔ tier v čase
  id, tenant_id
  member_id, tier_id
  valid_from, valid_to       # platnost / expirace
  status: active | expired | suspended | cancelled
  auto_renew: bool

MembershipCard               # fyzická karta = DataCarrier (qr | nfc | hybrid)
  membership_id
  data_carrier_id

MembershipBenefit            # konkrétní nárok tieru
  tier_id
  type: discount_percent | free_service | special_price | zone_access
  config_json                # % sleva / SKU / služba / zone_key
```

**Chování na scan:**
- Karta u brány → **Access Control** ověří aktivní `Membership` a tier pro `zone_key` → allow/deny (viz access-control.md).
- Karta na pokladně → **Payment** načte tier a aplikuje `MembershipBenefit` (sleva / speciální cena / zdarma).
- Karta v self-service → zobrazí členskou kartu, platnost, benefity, stav bodů (z Loyalty).

**Napojení na ostatní moduly:**
- **Access Control** – vstup do zón (sdílená schopnost, ADR-0006)
- **Payment** – slevy, speciální ceny, služby zdarma (Payment čte `MembershipBenefit`)
- **Loyalty** – sdílená identita zákazníka (`Member` ≈ `Customer`), body a kupony
- **Billing** – předplatné členství (recurring platby): `Subscription` řídí `Membership.valid_to` a status; při neplacení → grace → `expired` → Access Control odepře vstup (viz `docs/reference/billing.md`, ADR-0007)

> **Poznámka k identitě:** `Member` (Membership), `Customer` (Loyalty) a `RenterProfile` (Rental) jsou variace téhož vzoru „perzistentní identita koncového uživatele". `Member`/`Customer` jsou **per-tenant** (na rozdíl od platformového `RenterProfile`, ADR-0005). Do budoucna zvážit sjednocení do společného `Party`/`Person` konceptu – teď vedeno jako backlog poznámka.

---

## RBAC matice (Retail moduly)

| Oprávnění | Product | Loyalty | Payment | Inventory | Trace | Membership |
|---|---|---|---|---|---|---|
| `manage` | vytvářet/mazat produkty, měnit stav | správa programů, kampaní | správa platebních metod | správa skladu, inventura | správa šarží, DPP | správa tierů, benefitů, zón |
| `edit` | upravovat texty, fotky, návody | úprava kuponů, bodů | – | změna množství, pohyby | aktualizace certifikátů | zakládat/rušit členství, vydávat karty |
| `view` | karta + statistiky | přehledy, body zákazníka | účtenky, reporty | stav skladu | compliance reporty | přehled členů, platnosti |
| `scan_only` | zobrazit kartu | načíst program / body | spustit platbu | skenovat položku | zobrazit DPP | odbavit člena u brány/pokladny |

## Závislosti na core
- `DigitalObject.module_type` = `product` / `loyalty` / `pay` / `inventory` / `trace` / `membership`
- Vše musí mít `tenant_id`
- ScanEvent loguje každý sken/tap
- Membership využívá sdílený **Access Control** (`docs/reference/access-control.md`)
