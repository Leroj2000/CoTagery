# EPIC-01-AUTH – Specifikace autentizace

## Cíl
Implementace kompletního auth systému pro Tagery: JWT s refresh tokeny jako základ, OAuth2/SSO jako rozšíření.

## Scope

### In scope
- JWT access token (krátká životnost) + refresh token (dlouhá životnost)
- Revokace tokenů (blacklist nebo rotation)
- Samoobslužná registrace firmy a ověření e-mailu
- Invite flow (pozvání uživatele do tenantu e-mailem)
- Password reset flow

### Out of scope
- 2FA / MFA (plánováno v dalším EPICu)
- Biometrická autentizace
- OAuth2, Microsoft a SAML SSO (post-MVP)

## Stav: ✅ základní MVP auth hotový (2026-09-06); federované přihlášení je post-MVP

## Acceptance kritéria
- [x] Access token expiruje do 15 minut (expiresIn 900, ověřeno)
- [x] Refresh token rotation při každém použití + reuse detekce (revokace řetězce)
- [x] Registrace firmy + OWNER účet s ověřením e-mailu jednorázovým odkazem
- [x] Invite e-mail odeslán a jednorázový token platný 24h
- [x] `tenant_id` vždy v JWT payload (guard plní request.user)
- [x] Revokace tokenu okamžitě účinná (logout + reuse)

## Závislosti
- Modul User a Tenant musí existovat (core schema)
- E-mailová služba (SMTP / SendGrid)

## Podúkoly
- [x] TASK-01-JWT – JWT access + refresh token flow ✅
- [x] TASK-03-INVITE – Invite flow a e-mailové šablony
- [ ] TASK-02-OAUTH – OAuth2 Google + Microsoft (post-MVP)
