import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

interface TenantStore {
  tenantId: string;
  manager: EntityManager;
}

/**
 * Drží per-request tenant kontext (AsyncLocalStorage): aktivní `tenant_id`
 * a transakční EntityManager, jehož spojení má nastavené `app.tenant_id`
 * (na tom stojí PostgreSQL RLS – ADR-0001).
 */
@Injectable()
export class TenantContextService {
  private readonly als = new AsyncLocalStorage<TenantStore>();

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  run<T>(store: TenantStore, fn: () => Promise<T>): Promise<T> {
    return this.als.run(store, fn);
  }

  /**
   * Spustí `fn` v transakci s nastaveným `app.tenant_id` (RLS kontext).
   * Používá interceptor pro requesty i resolver pro modulové handlery.
   */
  async runInTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    await queryRunner.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantId]);
    try {
      const result = await this.als.run({ tenantId, manager: queryRunner.manager }, fn);
      await queryRunner.commitTransaction();
      return result;
    } catch (err) {
      await queryRunner.rollbackTransaction().catch(() => undefined);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  get tenantId(): string | undefined {
    return this.als.getStore()?.tenantId;
  }

  /** Manager s aktivním tenant kontextem; mimo request fallback na výchozí. */
  get manager(): EntityManager {
    return this.als.getStore()?.manager ?? this.dataSource.manager;
  }
}
