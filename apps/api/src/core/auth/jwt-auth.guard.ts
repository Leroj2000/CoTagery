import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { TenantRole } from '@tagery/shared';

export interface RequestUser {
  userId: string;
  tenantId: string;
  tenantRole: TenantRole;
  membershipId?: string | null;
}

interface AuthedRequest {
  headers: { authorization?: string };
  user?: RequestUser;
}

/** Ověří access token, naplní request.user tenant kontextem (ADR-0001). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Chybí Bearer token');
    }

    try {
      const payload = await this.jwt.verifyAsync<Record<string, unknown>>(header.slice(7));
      // Odmítni refresh token (má `jti`) použitý jako access token.
      if ('jti' in payload || typeof payload.tenantRole !== 'string') {
        throw new UnauthorizedException('Nesprávný typ tokenu');
      }
      req.user = {
        userId: payload.sub as string,
        tenantId: payload.tenantId as string,
        tenantRole: payload.tenantRole as TenantRole,
        membershipId: (payload.membershipId as string | undefined) ?? null,
      };
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Neplatný nebo expirovaný token');
    }
  }
}
