import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

/** Nájemce z renter tokenu (scope='renter'). Odděleno od org RequestUser. */
export interface RequestRenter {
  userId: string;
  email: string;
  name: string;
}

interface RenterRequest {
  headers: { authorization?: string };
  renter?: RequestRenter;
}

/**
 * Ověří renter token a naplní `request.renter`. ZÁMĚRNĚ nenastavuje `request.user`
 * → TenantTransactionInterceptor přeskočí a nájemce nedostane žádný org tenant
 * kontext (nulový přístup k datům firem). Data čte jen přes SECURITY DEFINER.
 */
@Injectable()
export class RenterJwtGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RenterRequest>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Chybí Bearer token');
    }
    try {
      const payload = await this.jwt.verifyAsync<Record<string, unknown>>(header.slice(7));
      if (payload.scope !== 'renter' || typeof payload.sub !== 'string') {
        throw new UnauthorizedException('Nesprávný typ tokenu');
      }
      req.renter = {
        userId: payload.sub,
        email: (payload.email as string) ?? '',
        name: (payload.name as string) ?? '',
      };
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Neplatný nebo expirovaný token');
    }
  }
}

/** Vrátí ověřeného nájemce z requestu (po RenterJwtGuard). */
export const CurrentRenter = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestRenter | undefined => {
    return ctx.switchToHttp().getRequest<RenterRequest>().renter;
  },
);
