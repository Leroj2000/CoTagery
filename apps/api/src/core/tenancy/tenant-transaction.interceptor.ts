import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { from, lastValueFrom, Observable } from 'rxjs';
import type { RequestUser } from '../auth/jwt-auth.guard';
import { TenantContextService, type EffectiveScope } from './tenant-context.service';

/**
 * Pro autentizované requesty spustí handler v tenant kontextu (transakce se
 * `SET LOCAL app.tenant_id` = AKTIVNÍ organizace z JWT). Navíc:
 *  - 0.3: vynutí AKTIVNÍ členství identity v org (jinak deny),
 *  - 2.2: vyřeší efektivní scope z `role_assignments` a uloží do kontextu
 *    (list dotazy pak filtrují dle location-tree). Vše jedním dotazem pod RLS.
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
        // Aktivní členství + jeho scope (pod RLS = jen aktivní org).
        const rows: { scope_type: EffectiveScope['type']; scope_ref: string | null }[] =
          await this.context.manager.query(
            `SELECT ra.scope_type, ra.scope_ref
               FROM org_memberships m
               JOIN role_assignments ra ON ra.membership_id = m.id
              WHERE m.user_id = $1 AND m.status = 'active'
              ORDER BY CASE ra.scope_type WHEN 'ORGANIZATION' THEN 0 ELSE 1 END
              LIMIT 1`,
            [user.userId],
          );
        if (rows.length === 0) {
          throw new ForbiddenException('Členství v této organizaci není aktivní');
        }
        this.context.setScope({ type: rows[0].scope_type, ref: rows[0].scope_ref });
        return lastValueFrom(next.handle());
      }),
    );
  }
}
