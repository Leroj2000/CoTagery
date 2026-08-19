import { SetMetadata, type CustomDecorator } from '@nestjs/common';

export const REQUIRE_PERMISSION_KEY = 'require_permission';

/**
 * Vyžaduje konkrétní permission key (EPIC-18 Fáze 1.4). Použití s `PermissionsGuard`:
 * `@RequirePermission('asset.item.update')`. Nahrazuje hrubé `@RequireRole`.
 */
export const RequirePermission = (permission: string): CustomDecorator =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permission);
