import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RequestUser } from '../auth/jwt-auth.guard';
import { AuthzService } from './authz.service';
import { ALLOW_AUTHENTICATED_ONLY_KEY, REQUIRE_PERMISSION_KEY } from './require-permission.decorator';
import { REQUIRE_MODULE_KEY } from './require-module.decorator';

/**
 * Vynucení permission (EPIC-18 Fáze 1.4). Nahrazuje `RolesGuard`/`@RequireRole`.
 * Fail-closed (M3 security hardening): bez `@RequirePermission` endpoint zamítne
 * přístup, pokud nemá explicitní `@AllowAuthenticatedOnly()` (vědomá výjimka pro
 * operace, kde stačí platná autentizace).
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
    const allowAuthenticatedOnly = this.reflector.getAllAndOverride<boolean | undefined>(
      ALLOW_AUTHENTICATED_ONLY_KEY,
      [context.getHandler(), context.getClass()],
    );
    const user = context.switchToHttp().getRequest<{ user?: RequestUser }>().user;
    if (!user) throw new UnauthorizedException('Chybí autentizace');
    if (moduleKey) await this.authz.assertModuleActive(user, moduleKey);
    if (required) {
      await this.authz.assert(user, required);
      return true;
    }
    if (allowAuthenticatedOnly) return true;
    throw new ForbiddenException(
      'Endpoint vyžaduje @RequirePermission, nebo explicitně @AllowAuthenticatedOnly().',
    );
  }
}
