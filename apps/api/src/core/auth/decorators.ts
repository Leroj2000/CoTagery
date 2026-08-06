import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequestUser } from './jwt-auth.guard';

interface AuthedRequest {
  user?: RequestUser;
}

/** Vrátí ověřeného uživatele z request kontextu (po JwtAuthGuard). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser | undefined => {
    return ctx.switchToHttp().getRequest<AuthedRequest>().user;
  },
);

/** Vrátí tenant_id ověřeného uživatele (ADR-0001 – nikdy z URL/body). */
export const TenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    return ctx.switchToHttp().getRequest<AuthedRequest>().user?.tenantId;
  },
);
