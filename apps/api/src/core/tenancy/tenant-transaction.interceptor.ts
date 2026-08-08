import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { from, lastValueFrom, Observable } from 'rxjs';
import type { RequestUser } from '../auth/jwt-auth.guard';
import { TenantContextService } from './tenant-context.service';

/**
 * Pro autentizované requesty otevře transakci, nastaví `SET LOCAL app.tenant_id`
 * z JWT a spustí handler v tenant kontextu (ALS). Commit při úspěchu, rollback
 * při chybě. Neautentizované routy (auth, health, resolver) propouští beze změny.
 */
@Injectable()
export class TenantTransactionInterceptor implements NestInterceptor {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly context: TenantContextService,
  ) {}

  intercept(executionContext: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = executionContext.switchToHttp().getRequest<{ user?: RequestUser }>();
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return next.handle();
    }

    const runInTransaction = async (): Promise<unknown> => {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
      // SET LOCAL app.tenant_id (platí jen v této transakci) – zdroj pravdy pro RLS.
      await queryRunner.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId]);

      try {
        const result = await this.context.run(
          { tenantId, manager: queryRunner.manager },
          () => lastValueFrom(next.handle()),
        );
        await queryRunner.commitTransaction();
        return result;
      } catch (err) {
        await queryRunner.rollbackTransaction().catch(() => undefined);
        throw err;
      } finally {
        await queryRunner.release();
      }
    };

    return from(runInTransaction());
  }
}
