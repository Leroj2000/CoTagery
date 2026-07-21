# ADR-0005 – Identita a reputace nájemce: platformově sdílená (Uber/Bolt model)

- **Stav:** Přijato
- **Datum:** 2026-07-19

## Kontext
Rental modul zavádí ověření nájemce a oboustranné hodnocení. Produktové rozhodnutí: reputace má fungovat **jako u Uber/Bolt** – hodnocení a ověření následují osobu **napříč všemi pronajímateli (tenanty)**, ne izolovaně u každé firmy.

To je vědomá, **úzce vymezená výjimka** z ADR-0001 (jinak „vše má `tenant_id`"): reputace nájemce je sdílený platformový zdroj. Ostatní rental data (půjčky, smlouvy, condition reports, kauce) **zůstávají tenant-izolovaná**.

## Rozhodnutí

### Platformová identita nájemce
- `RenterProfile` je **platformová entita** (nemá `tenant_id`), klíčovaná ověřenou identitou (telefon/e-mail, případně KYC).
- Zavádíme kategorii **„platform-shared entities"** – malá, explicitně vyjmenovaná množina tabulek mimo tenant RLS. Přístup jen přes dedikovaný service layer s vlastní autorizací (ne přímo přes tenant kontext).

### Reputace jako u Uber/Bolt
- **Oboustranná**: pronajímatel (business/location) i nájemce mají skóre.
- **Rolling average** z hodnocení (např. posledních N transakcí), 1–5 hvězd.
- **Anonymizovaná jednotlivá hodnocení**: hodnocený vidí jen svůj agregát, ne kdo co dal (jako Uber). Zabraňuje odvetě.
- **Prahy s důsledky**: nájemce pod prahem → tenant může odmítnout/blokovat; skóre pronajímatele se ukazuje nájemci.
- Ověření (`IdentityVerification`) je rovněž **platformové** – ověř jednou, platí všude; tenant si per-Item definuje jen *minimální požadovanou úroveň*.

### Souhlas a soukromí (podmínka výjimky)
- Nájemce při prvním použití dá **explicitní souhlas** se sdílenou reputací (ToS/consent) – bez něj nelze platformový profil vést.
- **Data minimization**: sdílí se jen agregované skóre a status ověření, ne detailní historie ani citlivé PII/doklady.
- **Právo na výmaz**: profil anonymizovat, vazby na půjčky u tenantů zůstávají (integrita), reputace se odpojí.
- Sdílení musí projít bezpečnostním review (Stage 04) kvůli difamaci a cross-tenant úniku.

## Důsledky
- **Pozitivní:** silný síťový efekt, přenositelná důvěra, lepší UX pro nájemce i pronajímatele.
- **Negativní / rizika:** nutná robustní consent vrstva, moderace sporů, ochrana proti difamaci; platform-shared entity je bezpečnostně citlivá – musí mít vlastní striktní autorizaci mimo tenant RLS.
- **Model:** `Loan` (tenant-scoped) → odkazuje na `RenterProfile` (platform-scoped). Review se píše v tenant kontextu, agreguje na platformový profil.

## Vztah k ADR-0001
ADR-0001 zůstává výchozím pravidlem. Toto je jediná povolená výjimka; každá další platform-shared entita vyžaduje nové ADR a bezpečnostní review.
