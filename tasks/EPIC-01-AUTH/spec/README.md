# EPIC-01-AUTH – Specifikace autentizace

## Cíl
Implementace kompletního auth systému pro Tagery: JWT s refresh tokeny jako základ, OAuth2/SSO jako rozšíření.

## Scope

### In scope
- JWT access token (krátká životnost) + refresh token (dlouhá životnost)
- Revokace tokenů (blacklist nebo rotation)
- OAuth2 integrace: Google, Microsoft
- SAML SSO pro enterprise tenanty
- Invite flow (pozvání uživatele do tenantu e-mailem)
- Password reset flow

### Out of scope
- 2FA / MFA (plánováno v dalším EPICu)
- Biometrická autentizace

## Stav: 🟡 TASK-01-JWT hotový (2026-08-06); OAuth2 + invite zbývají

## Acceptance kritéria
- [x] Access token expiruje do 15 minut (expiresIn 900, ověřeno)
- [x] Refresh token rotation při každém použití + reuse detekce (revokace řetězce)
- [ ] OAuth2 login (Google) funkční – TASK-02
- [ ] Invite e-mail odeslán a token platný 48h – TASK-03
- [x] `tenant_id` vždy v JWT payload (guard plní request.user)
- [x] Revokace tokenu okamžitě účinná (logout + reuse)

## Závislosti
- Modul User a Tenant musí existovat (core schema)
- E-mailová služba (SMTP / SendGrid)

## Podúkoly
- [x] TASK-01-JWT – JWT access + refresh token flow ✅
- [ ] TASK-02-OAUTH – OAuth2 Google + Microsoft
- [ ] TASK-03-INVITE – Invite flow a e-mailové šablony
