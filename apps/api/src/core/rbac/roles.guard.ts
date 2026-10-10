import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  type CustomDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { TenantRole } from '@tagery/shared';
import type { RequestUser } from '../auth/jwt-auth.guard';
import { roleMeets } from './tenant-role-rank';

export const REQUIRE_ROLE_KEY = 'require_role';

/**
 * Vyžaduje minimální globální roli v tenantu pro daný endpoint (mutace).
 * Použití: `@UseGuards(JwtAuthGuard, RolesGuard)` + `@RequireRole('EDITOR')`.
 */
export const RequireRole = (role: TenantRole): CustomDecorator =>
  SetMetadata(REQUIRE_ROLE_KEY, role);

/**
 * Ověří, že role uživatele (z JWT, po JwtAuthGuard) splňuje požadavek.
 * Fail-closed (M3 security hardening): endpoint bez `@RequireRole` je zamítnut –
 * tento guard se používá výhradně společně s `@RequireRole`, jinak hrozí, že se
 * anotace na mutačním endpointu omylem zapomene a request tiše projde jen na
 * základě platné autentizace.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<TenantRole | undefined>(REQUIRE_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const user = context.switchToHttp().getRequest<{ user?: RequestUser }>().user;
    if (!user) throw new UnauthorizedException('Chybí autentizace');
    if (!required) {
      throw new ForbiddenException('Endpoint vyžaduje @RequireRole.');
    }
    if (!roleMeets(user.tenantRole as TenantRole, required)) {
      throw new ForbiddenException(`Vyžadována role alespoň ${required}`);
    }
    return true;
  }
}
