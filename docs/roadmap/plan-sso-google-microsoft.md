# Plán: přihlášení přes Google a Microsoft (BACKLOG AUTH-01)

> Stav: **plán, nic není nasazeno**. Kód půjde za vypnutý přepínač `AUTH_SSO_ENABLED=0`;
> zapne se až po založení OAuth klientů (kap. 1) a ověření na stagingu/smoke stacku.

## 1. Co musí Štěpán založit (přesně)

### Google (Google Cloud Console, účet firmy)
1. Projekt `Tagery` → **APIs & Services → OAuth consent screen** (Google Auth Platform → Branding):
   - User type: **External**, název aplikace `Tagery`, support e-mail, logo (volitelně).
   - App domain: `https://app.tagery.tech`, Authorized domain: `tagery.tech`.
   - Odkazy na **zásady ochrany OÚ** a **podmínky** (musí existovat veřejně).
   - Scopes: `openid`, `email`, `profile` (nesenzitivní – bez bezpečnostního auditu Googlu).
   - Publikovat (Publishing status → In production), jinak se přihlásí jen testovací uživatelé.
2. **Credentials → Create credentials → OAuth client ID → Web application**, název `Tagery web`:
   - Authorized JavaScript origins: `https://app.tagery.tech`
   - Authorized redirect URIs:
     - `https://app.tagery.tech/api/auth/oauth/google/callback`
     - (vývoj, volitelně) `http://localhost:3000/api/auth/oauth/google/callback`
3. Předat mi (bezpečně, ne do chatu v plaintextu – ideálně rovnou do `/root/projects/tagery/.env` na VPS):
   `OAUTH_GOOGLE_CLIENT_ID`, `OAUTH_GOOGLE_CLIENT_SECRET`.

### Microsoft (Microsoft Entra admin center, entra.microsoft.com)
1. **App registrations → New registration**, název `Tagery`:
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts** (= tenant `common`).
     Pokud chceš jen firemní účty (bez @outlook.com): *any organizational directory* (= `organizations`).
   - Redirect URI: platforma **Web**, `https://app.tagery.tech/api/auth/oauth/microsoft/callback`
     (+ volitelně `http://localhost:3000/api/auth/oauth/microsoft/callback`).
2. **Certificates & secrets → New client secret** (platnost 24 měsíců – dej si připomínku na obnovu).
3. **API permissions**: Microsoft Graph → Delegated → `openid`, `email`, `profile` (výchozí `User.Read` může zůstat). Admin consent není potřeba.
4. **Token configuration → Add optional claim** (ID token): `email`, `xms_edov` (ověřená doména e-mailu).
5. **Branding & properties**: publisher domain `tagery.tech`; doporučeno **Publisher verification** (MPN/Partner ID), jinak uživatelé uvidí „neověřený vydavatel“.
6. Předat: `OAUTH_MICROSOFT_CLIENT_ID` (Application (client) ID), `OAUTH_MICROSOFT_CLIENT_SECRET` (Value, ne Secret ID), `OAUTH_MICROSOFT_TENANT` (`common` nebo `organizations`).

### Proměnné prostředí (API)
```
AUTH_SSO_ENABLED=0            # 1 = zobrazit tlačítka a povolit callbacky
OAUTH_GOOGLE_CLIENT_ID=
OAUTH_GOOGLE_CLIENT_SECRET=
OAUTH_MICROSOFT_CLIENT_ID=
OAUTH_MICROSOFT_CLIENT_SECRET=
OAUTH_MICROSOFT_TENANT=common
PUBLIC_WEB_URL=https://app.tagery.tech   # už existuje – z něj se skládají redirect URI
```

## 2. Návrh řešení

**Tok (Authorization Code + PKCE, server-side):**
1. Web `GET /api/auth/oauth/{google|microsoft}/start?from=/admin` – BFF vygeneruje `state`, `nonce`, PKCE `code_verifier`; uloží je do krátké httpOnly cookie (10 min, SameSite=Lax) a přesměruje na poskytovatele.
2. Poskytovatel vrátí na `/api/auth/oauth/{provider}/callback?code&state`. BFF ověří `state` z cookie a předá `code` + `code_verifier` + `nonce` do API `POST /api/v1/auth/oauth/{provider}/exchange`.
3. API vymění kód za tokeny, **ověří ID token** (podpis přes JWKS poskytovatele, `iss`, `aud`, `exp`, `nonce`), vytáhne `sub` (Microsoft `oid`+`tid`), e-mail a jméno.
4. Párování: `user_identities(provider, subject)` → existující uživatel → vydá běžný pár access/refresh tokenů (stejné jako `/auth/login`); BFF nastaví stávající session cookies.

**Párování na existující účet (bezpečnost):**
- Google: spárovat podle e-mailu jen při `email_verified=true`.
- Microsoft: e-mail není garantovaně ověřený → automaticky párovat jen při `xms_edov=true`; jinak vyžadovat přihlášení heslem a ruční „Propojit účet“ v profilu.
- Nový e-mail bez účtu: **neregistrovat automaticky** (viz otázka 1) – zobrazit „Účet neexistuje, požádejte o pozvánku / zaregistrujte se“. Pozvánku (accept-invite) půjde přijmout přes SSO, pokud e-mail sedí.

**Data (aditivní migrace):** nová tabulka `user_identities` (id, user_id → users, provider, subject, email, provider_tenant_id, created_at, last_login_at; unique(provider, subject)). `users.password_hash` zůstává povinný – SSO-only uživatelům se uloží náhodný nepoužitelný hash (žádná změna NOT NULL).

**UI:** na `/login` a `/accept-invite` tlačítka „Pokračovat přes Google / Microsoft“ jen při `AUTH_SSO_ENABLED=1` (API `GET /auth/sso-providers` vrátí zapnuté poskytovatele). V profilu „Propojené účty“ (propojit / odpojit; odpojit nelze, pokud by uživatel zůstal bez metody přihlášení).

**Závislosti:** knihovna `jose` (ověření JWT přes JWKS) – jediná nová závislost; bez `passport-*`.

**Testy:** unit testy ověření ID tokenu (vlastní testovací JWKS), párovací pravidla, odmítnutí špatného `state`/`nonce`; smoke se stubem poskytovatele (lokální OIDC mock v izolovaném stacku).

**Mobilní aplikace (Capacitor):** později – vyžaduje systémový prohlížeč + deep link (`tagery://auth/callback`) a samostatný redirect URI; mimo rozsah první verze.

## 3. Fáze
1. Kód za flagem `AUTH_SSO_ENABLED=0` + migrace `user_identities` + testy (lze udělat hned, nic se nezmění pro uživatele).
2. Štěpán založí klienty (kap. 1) a doplní `.env`.
3. Ověření na smoke stacku + na produkci s flagem jen pro platform admina, pak zapnout všem.

## 4. Otázky na Štěpána
1. Má SSO umět i **registraci nové firmy** (nový e-mail → nová organizace), nebo jen přihlášení existujících a přijetí pozvánky? (doporučuji zatím jen to druhé)
2. Microsoft: povolit i osobní účty (`common`), nebo jen firemní (`organizations`)?
3. Mají mít firmy možnost **vynutit SSO** (zakázat heslo pro svou doménu)? To už je spíš ENT-01.
