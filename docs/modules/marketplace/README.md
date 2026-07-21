# Modul: Marketplace, Rental, Contact, Time Tracking (AS IS)

---

## 4. RBAC a ACL model (platí pro celou platformu)

### 4.1 Globální role v rámci tenantu

| Role | Oprávnění |
|---|---|
| `OWNER` | Full control – vše včetně správy práv, fakturace, zrušení tenantu |
| `ADMIN` | Správa lidí a modulů, bez owner-only akcí |
| `MANAGER` | Správa objektů a operací v modulech, bez globálního nastavení |
| `EDITOR` | Vytváření a úprava objektů, bez správy práv |
| `VIEWER` | Read-only přístup (podle ACL) |
| `SCAN_ONLY` | Žádný admin UI, jen operace přes scan/tap |

### 4.2 Per-objektová oprávnění (ACL)

```
ObjectPermission
  id
  digital_object_id
  tenant_id
  subject_type: user | group | tenant
  subject_id
  permission: owner | manage | edit | view | scan_only
  created_at
  expires_at (volitelné)
```

**Pravidla:**
- `OWNER` tenantu má implicitně `owner` na všechny objekty
- `ADMIN` má minimálně `manage` na všechny objekty
- `subject_type=tenant, permission=view` → všichni uživatelé tenantu objekt vidí
- Backend ověřuje: globální právo (OWNER/ADMIN) NEBO `ObjectPermission.permission`

---

## 5.7 Rental modul (půjčování věcí)

**Use-case:** QR/NFC na půjčované věci (nářadí, technika, kola, interní vybavení) → komu půjčeno, do kdy, fotky při výdeji, stav.

**Entity:**
```
Item
  digital_object_id
  owner_id (Tenant / Location)
  name, description, serial_number
  photos_json
  care_manual_url
  price_per_day
  deposit
  required_verification_level  # min. úroveň ověření nájemce (viz níže)

RenterProfile                  # PLATFORMOVÁ identita nájemce – sdílená napříč tenanty (ADR-0005)
  id                           # BEZ tenant_id – platform-shared entita
  linked_user_id (nullable)    # pokud je nájemce zároveň User v systému
  display_name
  email, phone                 # klíč identity (ověřený)
  verification_level: none | contact | document | full_kyc
  rating_avg, rating_count     # ROLLING agregát napříč všemi pronajímateli (Uber/Bolt)
  consent_shared_reputation_at # souhlas se sdílenou reputací (podmínka existence profilu)
  status: active | blocked
  created_at, updated_at

RentalContract / Loan
  item_id
  tenant_id                    # půjčka JE tenant-izolovaná
  renter_profile_id            # odkaz na platformový profil nájemce
  rental_start, rental_end
  price_total, deposit
  status: pending_verification | active | returned | cancelled | disputed
  review_window_closes_at      # okno pro oboustranné hodnocení

ConditionReport
  loan_id
  type: handover | return
  photos_json
  notes
  damage_assessed
```

### Ověření nájemce (identity verification)
Před výdejem věci se ověří identita nájemce. Úroveň je **stupňovitá** a konfigurovatelná per Item (typicky dle hodnoty věci / výše kauce).

```
IdentityVerification
  renter_profile_id
  loan_id (nullable)           # ke konkrétní půjčce nebo jednorázově k profilu
  level: contact | document | full_kyc
  method: email_otp | sms_otp | id_document | provider_kyc
  status: pending | verified | rejected | expired
  provider_ref (nullable)      # reference u 3rd-party KYC, NE raw dokumenty
  verified_at, expires_at
```

| Úroveň | Co ověřuje | Jak |
|---|---|---|
| `contact` | e-mail / telefon | OTP kód |
| `document` | doklad totožnosti | upload skenu (šifrovaně, retenční politika) |
| `full_kyc` | plná KYC | delegováno na 3rd-party providera, ukládáme jen výsledek + referenci |

Ověření je **platformové** (ADR-0005): nájemce se ověří jednou a platí napříč tenanty; tenant si per-Item určuje jen *minimální požadovanou úroveň*, kterou musí profil splňovat.

**GDPR / bezpečnost (kritické):**
- Doklady totožnosti = citlivé PII → šifrování at-rest, přísný přístup (jen `manage`+), **data minimization** (raw doklady ideálně u providera, ne u nás).
- Retenční politika: verifikační artefakty se mažou po uplynutí `expires_at` / skončení účelu.
- Právo na výmaz: profil a hodnocení anonymizovat, ne mazat vazby (integrita historie).

### Oboustranné hodnocení (Uber/Bolt model)
Po vrácení věci hodnotí **obě strany**: pronajímatel nájemce i nájemce pronajímatele. Reputace je **platformová a přenositelná** (ADR-0005).

```
RentalReview
  loan_id
  direction: lessor_to_renter | renter_to_lessor
  reviewer_ref, reviewee_ref   # lessor (tenant/location) nebo platformový RenterProfile
  rating: 1..5
  comment (nullable)
  status: hidden | published    # double-blind reveal
  created_at
```

**Pravidla (jako Uber/Bolt):**
- **Rolling average**: skóre = klouzavý průměr posledních N hodnocení, ne celoživotní součet.
- **Anonymizovaná jednotlivá hodnocení**: hodnocený vidí jen svůj agregát, ne kdo konkrétně jak ohodnotil.
- **Double-blind reveal** (anti-odveta): hodnocení je `hidden`, dokud nezhodnotí i druhá strana nebo neuplyne `review_window_closes_at` (např. 14 dní).
- **Prahy s důsledky**: nájemce pod prahem → tenant ho může odmítnout/blokovat; skóre pronajímatele se zobrazuje nájemci před půjčkou.
- Hodnocení jen k dokončené (`returned`) půjčce, jednou za směr.
- Agregát se propisuje na **platformový** `RenterProfile.rating_avg` (napříč tenanty) a na reputaci pronajímatele (per tenant/location).

### Aktualizovaný tok půjčky
1. Nájemce žádá o věc → `Loan` ve stavu `pending_verification`.
2. Ověření identity na `Item.required_verification_level` → jinak nelze vydat.
3. Výdej: `ConditionReport(handover)` + kauce → `Loan.active`.
4. Vrácení: `ConditionReport(return)` → vypořádání kauce → `Loan.returned`, otevře se `review_window`.
5. Obě strany podají `RentalReview` (double-blind) → po revealu se propíše do reputace.

| Oprávnění | Akce |
|---|---|
| `manage` | správa věcí, ceníků, stavu, **konfigurace úrovně ověření**, řešení sporů |
| `edit` | vytvářet/ukončovat půjčky, fotit stav, **spustit ověření**, podat hodnocení za pronajímatele |
| `view` | přehled, historie, **agregát reputace** (ne citlivé verifikační PII) |
| `scan_only` | půjčování/vracení přes scan (v rámci ověřeného nájemce) |

---

## 5.9 Time & Event Tracking modul

**Use-case:** Docházka (příchod/odchod), sledování času, Pomodoro, návyky (léky, pitný režim, fitko), parkování.

**Entity:**
```
TimeTrackingPoint
  digital_object_id, tenant_id, location_id
  name
  type: work_entry_exit | habit_event | task_checkpoint | parking
  settings_json (jak párovat in/out)

TimeEvent
  time_tracking_point_id, digital_object_id, data_carrier_id
  user_id
  event_role: clock_in | clock_out | habit | break_start | break_end | parking_spot
  timestamp
  device_info_json, extra_data_json

TimeSession
  user_id, start_event_id, end_event_id
  start_time, end_time, duration_seconds
  location_id
  status: open | closed | auto_closed

HabitCounter
  user_id, time_tracking_point_id
  period: day | week | month
  period_start, period_end
  event_count, streak_days
```

| Oprávnění | Akce |
|---|---|
| `manage` | definice tracking bodů, reporty, export |
| `edit` | korekce session, správa bodů |
| `view` | docházkové reporty, návykové statistiky |
| `scan_only` | clock in/out, log návyků |

---

## 5.11 Contact / Identity modul

**Use-case:** Digitální vizitky, sdílení kontaktů, sociální profily.

**Entity:**
```
ContactCard
  digital_object_id
  name, position, company
  email, phone, website
  social_links_json
  vcard_payload
```

| Oprávnění | Akce |
|---|---|
| `manage` | firemní vizitky a šablony |
| `edit` | úprava vlastní vizitky |
| `view` | prohlížení vizitek |
| `scan_only` | načtení vizitky přes QR/NFC |
