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

/** Ověří, že role uživatele (z JWT, po JwtAuthGuard) splňuje požadavek. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<TenantRole | undefined>(REQUIRE_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true; // bez anotace = jen JwtAuthGuard

    const user = context.switchToHttp().getRequest<{ user?: RequestUser }>().user;
    if (!user) throw new UnauthorizedException('Chybí autentizace');
    if (!roleMeets(user.tenantRole, required)) {
      throw new ForbiddenException(`Vyžadována role alespoň ${required}`);
    }
    return true;
  }
}
