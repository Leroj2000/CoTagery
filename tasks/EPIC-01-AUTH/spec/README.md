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

## Acceptance kritéria
- [ ] Access token expiruje do 15 minut
- [ ] Refresh token rotation při každém použití
- [ ] OAuth2 login (Google) funkční
- [ ] Invite e-mail odeslán a token platný 48h
- [ ] `tenant_id` vždy v JWT payload
- [ ] Revokace tokenu okamžitě účinná

## Závislosti
- Modul User a Tenant musí existovat (core schema)
- E-mailová služba (SMTP / SendGrid)

## Podúkoly
- [ ] TASK-01-JWT – JWT access + refresh token flow
- [ ] TASK-02-OAUTH – OAuth2 Google + Microsoft
- [ ] TASK-03-INVITE – Invite flow a e-mailové šablony
