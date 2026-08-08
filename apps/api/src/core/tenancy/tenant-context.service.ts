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

  get tenantId(): string | undefined {
    return this.als.getStore()?.tenantId;
  }

  /** Manager s aktivním tenant kontextem; mimo request fallback na výchozí. */
  get manager(): EntityManager {
    return this.als.getStore()?.manager ?? this.dataSource.manager;
  }
}
