# FEAT – Veřejná self-aktivace kódu koncovým příjemcem

## Stav: 🟡 PIN varianta implementována a ověřena (2026-08-09)
Rozhodnutí: **PIN** (SMS doručení PINu = pozdější nádstavba). Implementováno:
- `POST /carriers/batch { selfActivatable, moduleTemplate }` → nosiče + 6místné PINy (v DB jen argon2 hash; plaintext PIN se vrací jen teď, k tisku)
- Veřejný `POST /r/{public_code}/activate { pin, payload }` (bez JWT, rate-limited): ověří PIN → vytvoří DigitalObject u vlastnícího tenanta (`runInTenant`) → naváže nosič → vrátí **edit-token** (bearer scope `object-edit` na daný objekt)
- SECURITY DEFINER `activation_lookup` (migrace SelfActivation); nosič nese `self_activatable` + `activation_pin_hash` + `module_template`
- Ověřeno e2e: batch+PIN → špatný PIN 401 → správný PIN → objekt+token → sken redirect → dvojitá aktivace 400; objekt vzniká u tenanta

## Follow-up
- Doručení PINu přes SMS (poskytovatel), edit-token authed edit endpointy, veřejná aktivační HTML stránka, per-modul obsahové šablony
- Zvážit OTP účet jako alternativu/doplněk PINu

## Původní návrh (pro kontext)

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
