import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RequestUser } from '../auth/jwt-auth.guard';
import { AuthzService } from './authz.service';
import { REQUIRE_PERMISSION_KEY } from './require-permission.decorator';
import { REQUIRE_MODULE_KEY } from './require-module.decorator';

/**
 * Vynucení permission (EPIC-18 Fáze 1.4). Připraveno; aplikuje se postupně místo
 * `RolesGuard`/`@RequireRole`. Bez `@RequirePermission` propouští (jen JwtAuthGuard).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authz: AuthzService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const moduleKey = this.reflector.getAllAndOverride<string | undefined>(REQUIRE_MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const required = this.reflector.getAllAndOverride<string | undefined>(REQUIRE_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const user = context.switchToHttp().getRequest<{ user?: RequestUser }>().user;
    if (!user) throw new UnauthorizedException('Chybí autentizace');
    if (moduleKey) await this.authz.assertModuleActive(user, moduleKey);
    if (!required) return true;
    await this.authz.assert(user, required);
    return true;
  }
}
