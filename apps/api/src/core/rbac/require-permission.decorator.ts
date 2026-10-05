import { SetMetadata, type CustomDecorator } from '@nestjs/common';

export const REQUIRE_PERMISSION_KEY = 'require_permission';
export const ALLOW_AUTHENTICATED_ONLY_KEY = 'allow_authenticated_only';

/**
 * Vyžaduje konkrétní permission key (EPIC-18 Fáze 1.4). Použití s `PermissionsGuard`:
 * `@RequirePermission('asset.item.update')`. Nahrazuje hrubé `@RequireRole`.
 */
export const RequirePermission = (permission: string): CustomDecorator =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permission);

/**
 * Explicitní, vědomá výjimka z fail-closed chování `PermissionsGuard` (M3 security
 * hardening): endpoint nevyžaduje konkrétní permission, stačí platná autentizace
 * (JwtAuthGuard). Použít jen tam, kde je to architektonicky zamýšlené (např. zápis
 * nad vlastními daty přihlášeného uživatele) – NIKDY jako náhrada za chybějící
 * `@RequirePermission` bez rozmyslu.
 */
export const AllowAuthenticatedOnly = (): CustomDecorator =>
  SetMetadata(ALLOW_AUTHENTICATED_ONLY_KEY, true);
