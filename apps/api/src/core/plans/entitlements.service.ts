import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PLAN_LIMITS, type LimitKey } from '@tagery/shared';
import { TenantContextService } from '../tenancy/tenant-context.service';
import { SubscriptionService } from './subscription.service';
import { pragueToday, withinLimit } from './plans.logic';

export interface LimitUsage {
  key: LimitKey;
  limit: number | null;
  used: number;
}

const LABELS = new Map(PLAN_LIMITS.map((l) => [l.key, l.label]));
const AI_METRIC = 'ai_requests';

/** Překročený limit předplatného (402, strojově čitelné pro web). */
export class PlanLimitReachedException extends HttpException {
  constructor(key: LimitKey, limit: number, used: number, planName: string) {
    super(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        reasonCode: 'plan_limit_reached',
        limitKey: key,
        limit,
        used,
        message: `Dosažen limit předplatného ${planName}: ${LABELS.get(key) ?? key} ${used}/${limit}. Pro navýšení kontaktujte správce Tagery.`,
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}

/**
 * Limity předplatného (EPIC-20 F2): počty se počítají pod RLS aktuální firmy,
 * strop = úroveň ⊕ výjimka firmy. Volá se na místech vzniku (položka,
 * identifikátor, místo, pozvánka, AI dotaz). Nic se nemaže – při snížení
 * úrovně se jen blokuje vznik nového.
 */
@Injectable()
export class EntitlementsService {
  constructor(
    private readonly context: TenantContextService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  private month(): string {
    return pragueToday().slice(0, 7);
  }

  async used(key: LimitKey): Promise<number> {
    const m = this.context.manager;
    const one = async (sql: string, params: unknown[] = []) =>
      Number((await m.query(sql, params))[0]?.n ?? 0);
    switch (key) {
      case 'assets':
        return one(`SELECT count(*)::int AS n FROM assets WHERE status <> 'retired'`);
      case 'users':
        return one(`SELECT count(*)::int AS n FROM org_memberships WHERE status = 'active'`);
      case 'carriers':
        return one(
          `SELECT count(*)::int AS n FROM data_carriers WHERE status IN ('unassigned','active')`,
        );
      case 'locations':
        return one(`SELECT count(*)::int AS n FROM locations WHERE type <> 'access_point'`);
      case 'storage_mb': {
        const bytes = await one(
          `SELECT COALESCE(sum(size_bytes),0)::bigint AS n FROM storage_objects WHERE tenant_id = $1 AND deleted_at IS NULL`,
          [this.context.tenantId],
        );
        return Math.ceil((bytes / (1024 * 1024)) * 10) / 10;
      }
      case 'ai_per_month':
        return one(
          `SELECT COALESCE(sum(quantity),0)::int AS n FROM platform_usage_meters WHERE metric = $1 AND period = $2`,
          [AI_METRIC, this.month()],
        );
    }
  }

  /** Limity a využití aktuální firmy (sekvenčně – jeden query runner). */
  async usage(): Promise<LimitUsage[]> {
    const overview = await this.subscriptions.overview(this.context.tenantId!);
    const out: LimitUsage[] = [];
    for (const l of PLAN_LIMITS) {
      out.push({ key: l.key, limit: overview.limits[l.key], used: await this.used(l.key) });
    }
    return out;
  }

  /** Kolik lze ještě založit (`null` = neomezeno). */
  async remaining(key: LimitKey): Promise<number | null> {
    const overview = await this.subscriptions.overview(this.context.tenantId!);
    const limit = overview.limits[key];
    if (limit == null) return null;
    return Math.max(0, limit - (await this.used(key)));
  }

  /** 402, pokud by vznik `adding` nových překročil limit. */
  async assertWithinLimit(key: LimitKey, adding = 1): Promise<void> {
    if (adding <= 0) return;
    const overview = await this.subscriptions.overview(this.context.tenantId!);
    const limit = overview.limits[key];
    if (limit == null) return;
    const used = await this.used(key);
    if (!withinLimit(limit, used, adding))
      throw new PlanLimitReachedException(key, limit, used, overview.effectivePlan.name);
  }

  /** Započte AI dotaz (po kontrole limitu). */
  async recordAiRequest(): Promise<void> {
    await this.context.manager.query(
      `INSERT INTO platform_usage_meters (tenant_id, period, metric, quantity)
       VALUES ($1, $2, $3, 1)
       ON CONFLICT (tenant_id, period, metric) DO UPDATE SET quantity = platform_usage_meters.quantity + 1, updated_at = now()`,
      [this.context.tenantId, this.month(), AI_METRIC],
    );
  }
}
