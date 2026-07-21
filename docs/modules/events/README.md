# Modul: Events (AS IS)

Events skupina zahrnuje 2 moduly: Ticketing a Shared Gallery.

---

## 5.6 Ticketing modul

**Use-case:** Prodej vstupenek na akce (konference, koncerty, kluby), QR/NFC vstupenka, check-in u vchodu.

**Entity:**
```
Event
  id, tenant_id, name, date, venue (Location), description, status

TicketType
  event_id, name, price, quantity, sales_start, sales_end

Ticket
  ticket_type_id, buyer_id, status: pending | paid | redeemed | cancelled
  qr/nfc DataCarrier reference

CheckIn
  ticket_id, scanned_at, operator_id, carrier_id
```

**Tok:**
1. Vytvoř `Event` + `TicketType`
2. Prodej → `Ticket` + `PaymentSession`
3. Úspěšná platba → `Ticket.status = paid`, vygenerovat `DataCarrier` (QR/NFC)
4. Vstup → scan → ověř ticket (paid, not redeemed) → `CheckIn`, `Ticket.status = redeemed`

> **Check-in přes Access Control:** vstup na akci využívá sdílenou schopnost **Access Control** (ADR-0006, `docs/reference/access-control.md`). Ticketing je poskytovatel nároku (`resolveEntitlement` = platný ticket); `CheckIn` je specializace `AccessEvent`.

---

## 5.8 Shared Gallery modul

**Use-case:** Sdílené galerie fotek/videí z eventů. QR/NFC → upload stránka nebo galerie, automatické mazání po čase.

**Entity:**
```
GalleryEvent
  digital_object_id
  name
  date
  owner_id
  upload_deadline
  delete_after_days
  is_private

GalleryAccess
  gallery_event_id
  token
  access_level: upload | view | manage

UploadItem
  gallery_event_id
  uploader_id
  file_url
  mime_type
  created_at
  status: pending | approved | rejected

ModerationFlag
RetentionPolicy
```

---

## RBAC matice (Events moduly)

| Oprávnění | Ticketing | Shared Gallery |
|---|---|---|
| `manage` | vytvářet eventy, typy vstupenek, nastavovat prodej | správa galerie, moderace, export |
| `edit` | upravovat konkrétní eventy | úprava galerie, moderace obsahu |
| `view` | prodeje, účastníci | prohlížení fotek |
| `scan_only` | check-in/check-out u dveří | upload přes QR |

## Závislosti na core
- `DigitalObject.module_type` = `ticket` | `gallery`
- `ScanEvent.event_type` = `checkin` / `checkout` / `upload`
- Ticketing využívá Payment modul pro `PaymentSession`
