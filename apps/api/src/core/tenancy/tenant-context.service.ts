import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

/** Efektivní datový rozsah identity v aktivní org (EPIC-18 Fáze 2). */
export interface EffectiveScope {
  type: 'ORGANIZATION' | 'LOCATION_TREE' | 'LOCATION_SET' | 'OWN';
  ref: string | null;
}

interface TenantStore {
  tenantId: string;
  manager: EntityManager;
  scope?: EffectiveScope;
  userId?: string;
  /** Akce po úspěšném COMMIT transakce (např. e-maily); jen v runInTenant. */
  afterCommit?: (() => Promise<void> | void)[];
}

/**
 * Drží per-request tenant kontext (AsyncLocalStorage): aktivní `tenant_id`
 * a transakční EntityManager, jehož spojení má nastavené `app.tenant_id`
 * (na tom stojí PostgreSQL RLS – ADR-0001).
 */
@Injectable()
export class TenantContextService {
  private readonly als = new AsyncLocalStorage<TenantStore>();
  private readonly logger = new Logger(TenantContextService.name);

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
    const afterCommit: (() => Promise<void> | void)[] = [];
    try {
      const result = await this.als.run(
        { tenantId, manager: queryRunner.manager, afterCommit },
        fn,
      );
      await queryRunner.commitTransaction();
      this.flushAfterCommit(afterCommit);
      return result;
    } catch (err) {
      await queryRunner.rollbackTransaction().catch(() => undefined);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Naplánuje akci až po úspěšném COMMIT aktuální tenant transakce (při rollbacku
   * se zahodí). Běží mimo kontext transakce, na pozadí; chyba akce se jen zaloguje
   * a nikdy neovlivní výsledek requestu. Mimo transakci se spustí hned (na pozadí).
   */
  afterCommit(fn: () => Promise<void> | void): void {
    const hooks = this.als.getStore()?.afterCommit;
    if (hooks) hooks.push(fn);
    else this.flushAfterCommit([fn]);
  }

  private flushAfterCommit(hooks: (() => Promise<void> | void)[]): void {
    for (const hook of hooks) {
      this.als.exit(() => {
        void Promise.resolve()
          .then(hook)
          .catch((e: unknown) => this.logger.warn(`Akce po commitu selhala: ${String(e)}`));
      });
    }
  }

  get tenantId(): string | undefined {
    return this.als.getStore()?.tenantId;
  }

  /** Efektivní scope aktivní identity (default ORGANIZATION). */
  get scope(): EffectiveScope {
    return this.als.getStore()?.scope ?? { type: 'ORGANIZATION', ref: null };
  }

  /** Nastaví scope do aktuálního request kontextu (volá interceptor). */
  setScope(scope: EffectiveScope): void {
    const store = this.als.getStore();
    if (store) store.scope = scope;
  }

  /** Actor (přihlášená identita) pro audit. */
  get userId(): string | undefined {
    return this.als.getStore()?.userId;
  }

  setActor(userId: string): void {
    const store = this.als.getStore();
    if (store) store.userId = userId;
  }

  /** Manager s aktivním tenant kontextem; mimo request fallback na výchozí. */
  get manager(): EntityManager {
    return this.als.getStore()?.manager ?? this.dataSource.manager;
  }
}
