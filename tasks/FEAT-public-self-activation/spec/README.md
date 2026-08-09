# FEAT – Veřejná self-aktivace kódu koncovým příjemcem

## Stav: ⬜ Backlog (odloženo, 2026-08-09) – čeká na rozhodnutí a naplánování

Rozšíření feature „předgenerované nepřiřazené nosiče" (pool + claim). Zatímco
implementovaný claim dělá **přihlášený uživatel tenanta**, tato nádstavba umožní,
aby si kód aktivoval **sám koncový příjemce nálepky** (bez účtu v tenantovi).

## Otevřené rozhodnutí (k potvrzení)
- **Autentizace příjemce:** aktivační **PIN** na nálepce (doporučeno – jednoduché, bezpečné) **vs.** lehký **OTP účet** (end-user identita).

## Návrh
1. Vlastnictví: objekt zůstává u **generujícího tenanta** (limity/billing za kartu – ADR-0007); příjemce má jen **delegovaná práva** na ten objekt (přes ObjectPermission / ACL – EPIC-06).
2. Anti-hijack (kritické): pouhý viditelný `public_code` nesmí stačit → **PIN oddělený od QR** (stírací pole) nebo první-aktivace-vyhrává + e-mail potvrzení.
3. Aktivace je **modulově závislá**: tenant u poolu zvolí `selfActivatable` + `moduleTemplate` (contact / gallery; product typicky ne).

## Rozsah práce (co dodělat)
- `activation_pin` (hash) na `DataCarrier` + `self_activatable` flag + `module_template`
- `POST /carriers/batch` rozšířit o `selfActivatable`, `moduleTemplate`, `withPin` (vrací i PIN pro tisk)
- Resolver: pro `unassigned` + `selfActivatable` vrátit aktivační stav (místo prostého „unassigned")
- **Veřejný** `POST /r/{public_code}/activate { pin, payload }` (bez JWT, rate-limited, anti-hijack): ověří PIN → vytvoří DigitalObject (tenant = vlastník poolu, modul = template) → naváže nosič → vrátí **edit-token** pro daný objekt
- Edit-token mechanismus (scoped bearer na jeden objekt) NEBO end-user OTP účet

## Co lze znovupoužít (už hotové)
- Pool nepřiřazených nosičů + claim (EPIC-04 rozšíření)
- ACL / ObjectPermission (EPIC-06) pro delegovaná práva
- Resolver stav „unassigned" (EPIC-05)
- Vzor end-user identity (`RenterProfile`, EPIC-10)

## Praktické use-casy
Viz níže / PICKUP – hlavní hodnota: hromadná pre-tisková výroba bez znalosti kupujícího;
kupující si obsah oživí sám.
