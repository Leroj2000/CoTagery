import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { from, lastValueFrom, Observable } from 'rxjs';
import type { RequestUser } from '../auth/jwt-auth.guard';
import { OrgMembership } from '../auth/entities/membership.entity';
import { TenantContextService } from './tenant-context.service';

/**
 * Pro autentizované requesty spustí handler v tenant kontextu (transakce se
 * `SET LOCAL app.tenant_id` = AKTIVNÍ organizace z JWT). Navíc (EPIC-18 0.3)
 * vynutí, že identita má v dané organizaci AKTIVNÍ členství – jinak deny
 * (spec: neaktivní membership = deny). Neautentizované routy propouští beze změny.
 */
@Injectable()
export class TenantTransactionInterceptor implements NestInterceptor {
  constructor(private readonly context: TenantContextService) {}

  intercept(executionContext: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = executionContext.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = req.user;
    if (!user?.tenantId) {
      return next.handle();
    }
    return from(
      this.context.runInTenant(user.tenantId, async () => {
        // Levný indexovaný COUNT pod RLS (jen aktivní org): membership musí žít.
        const active = await this.context.manager
          .getRepository(OrgMembership)
          .count({ where: { userId: user.userId, status: 'active' } });
        if (active === 0) {
          throw new ForbiddenException('Členství v této organizaci není aktivní');
        }
        return lastValueFrom(next.handle());
      }),
    );
  }
}
