# Tagery – Roadmapa a rozpad na EPICy

> TO BE plán. Odráží MVP prioritu z `docs/PRD.md` a `CONTEXT.md`.
> **Číslování:** číslo EPICu = stabilní ID (pořadí vzniku). **Exekuční pořadí řídí závislosti**, ne číslo (viz sloupec „Závisí na"). Např. EPIC-02-FABRICATION vzniklo brzy, ale běží až po EPIC-04.
> Legenda: ⬜ plánováno · 🟡 rozpracováno · ✅ hotovo

---

## Katalog EPICů (dle ID)

| ID | Název | Popis | Stav |
|---|---|---|---|
| EPIC-00 | FOUNDATION | Monorepo, NestJS+Next.js skeleton, Docker, CI/CD, migrace | ✅ |
| EPIC-01 | AUTH | JWT access+refresh, RBAC guard, OAuth2, invite | 🟡 |
| EPIC-02 | FABRICATION | Export výrobních souborů (tisk/gravírka/3D) nad DataCarrier | ⬜ |
| EPIC-03 | CORE-DOMAIN | Tenant, Location, User, Group, BaseTenantEntity, RLS | 🟡 |
| EPIC-04 | DIGITAL-OBJECT | DigitalObject + DataCarrier, QR gen, NFC párování | 🟡 |
| EPIC-05 | RESOLVER | `/r/{public_code}`, cache, async ScanEvent (ADR-0002) | 🟡 |
| EPIC-06 | RBAC-ACL | ObjectPermission, enforcement matice | ⬜ |
| EPIC-07 | ANALYTICS | ScanEvent agregace, dashboard | ⬜ |
| EPIC-08 | PRODUCT | Modul Product | ⬜ |
| EPIC-09 | TICKETING | Modul Ticketing + check-in | ⬜ |
| EPIC-10 | RENTAL | Modul Rental (+ ověření nájemce, oboustranné hodnocení) | ⬜ |
| EPIC-11 | GALLERY | Modul Shared Gallery | ⬜ |
| EPIC-12 | TIME-TRACKING | Modul Time & Event | ⬜ |
| EPIC-13 | AUTOMATION | Modul Automation | ⬜ |
| EPIC-14 | CONTACT | Modul Contact | ⬜ |
| EPIC-15 | ACCESS-CONTROL | Sdílená schopnost řízení vstupu (ADR-0006) – používá Ticketing i Membership | ⬜ |
| EPIC-16 | MEMBERSHIP | Klubové/nákupní členství: tiery, platnost, benefity, karty | ⬜ |
| EPIC-17 | BILLING | Sdílené předplatné (recurring přes PSP) – řídí platnost členství (ADR-0007) | ⬜ |

---

## Exekuční pořadí (dle závislostí)

### Fáze 0 – Základy
| Pořadí | EPIC | Závisí na |
|---|---|---|
| 1 | EPIC-00 FOUNDATION | – |
| 2 | EPIC-01 AUTH | 00 |
| 3 | EPIC-03 CORE-DOMAIN | 00, 01 |

### Fáze 1 – Objektové jádro + Resolver (srdce platformy)
| Pořadí | EPIC | Závisí na |
|---|---|---|
| 4 | EPIC-04 DIGITAL-OBJECT | 03 |
| 5 | EPIC-05 RESOLVER | 04 |
| 6 | EPIC-06 RBAC-ACL | 03, 04 |
| 7 | EPIC-02 FABRICATION | 04 (potřebuje DataCarrier) |
| 8 | EPIC-07 ANALYTICS | 05 |

### Fáze 2 – MVP moduly (v pořadí byznys hodnoty)
| Pořadí | EPIC | Pozn. |
|---|---|---|
| 9 | EPIC-08 PRODUCT | Validuje objektový model |
| 10 | EPIC-15 ACCESS-CONTROL | Sdílená schopnost – **před** Ticketing a Membership |
| 11 | EPIC-09 TICKETING | Check-in přes Access Control; potřebuje Payment stub |
| 12 | EPIC-10 RENTAL | Condition reports, fotky |
| 13 | EPIC-11 GALLERY | Média + retence + moderace |
| 14 | EPIC-17 BILLING | Předplatné přes PSP – **před** Membership |
| 15 | EPIC-16 MEMBERSHIP | Po Access Control + Billing + Payment + Loyalty identitě |
| 16 | EPIC-12 TIME-TRACKING | Docházka + 1 habit |
| 17 | EPIC-13 AUTOMATION | open_url + webhook |
| 18 | EPIC-14 CONTACT | vCard vizitky |

### Fáze 3 – Rozšíření (post-MVP)
Loyalty, Payment (plná PSP integrace), Inventory, Trace/DPP, GS1 Digital Link, SAML SSO, custom domény, billing tenantů, PWA, veřejné API + webhooky.

## Cross-cutting (průběžně)
Observability (OpenTelemetry, per-tenant metriky) · i18n (CS/EN) · přístupnost (WCAG 2.1 AA) · bezpečnostní a izolační testy (Stage 04) u každého datového EPICu.

---

## Definition of Done (pro každý EPIC)
1. Kód splňuje konvence (`CLAUDE.md`, ADR-0003) a prošel `stages/` checklisty.
2. Testy: unit + integration + izolační test cross-tenant (kde jsou data).
3. API zdokumentováno (OpenAPI/Swagger) a v souladu s `docs/reference/api-contracts.md`.
4. **AS IS dokumentace v `docs/` aktualizována** (poslední krok každého úkolu).
5. `PICKUP.md` aktualizován.
