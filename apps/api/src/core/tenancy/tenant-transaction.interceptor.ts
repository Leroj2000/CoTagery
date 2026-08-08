import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { from, lastValueFrom, Observable } from 'rxjs';
import type { RequestUser } from '../auth/jwt-auth.guard';
import { TenantContextService } from './tenant-context.service';

/**
 * Pro autentizované requesty spustí handler v tenant kontextu (transakce se
 * `SET LOCAL app.tenant_id` z JWT). Neautentizované routy propouští beze změny.
 */
@Injectable()
export class TenantTransactionInterceptor implements NestInterceptor {
  constructor(private readonly context: TenantContextService) {}

  intercept(executionContext: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = executionContext.switchToHttp().getRequest<{ user?: RequestUser }>();
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return next.handle();
    }
    return from(this.context.runInTenant(tenantId, () => lastValueFrom(next.handle())));
  }
}
