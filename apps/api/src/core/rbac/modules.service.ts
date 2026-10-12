import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PLAN_FEATURES, type EntitlementLock } from '@tagery/shared';
import { SubscriptionService } from '../plans/subscription.service';
import { Repository } from 'typeorm';
import { TenantContextService } from '../tenancy/tenant-context.service';
import { OrganizationModule } from './entities/organization-module.entity';
import { AuthzService, CONTROLLED_MODULES } from './authz.service';
import { AuditService } from './audit.service';

export interface ModuleState {
  moduleKey: string;
  /** Efektivní stav (volba vlastníka i předplatné) – podle něj web skrývá navigaci. */
  state: 'active' | 'inactive';
  kind: 'module' | 'feature';
  /** Volba vlastníka firmy. */
  ownerState: 'active' | 'inactive';
  /** Povoleno předplatným (úroveň ⊕ výjimka superadmina). */
  allowed: boolean;
  /** Proč nejde zapnout (zamčeno platformou). */
  lock: EntitlementLock;
}

const FEATURE_KEYS = new Set<string>(PLAN_FEATURES.map((f) => f.key));

/** Rozšíření mimo základní produkt Tagery Věci, vypnutá u nových organizací. */
export const MVP_DEFAULT_INACTIVE_MODULES = [
  'access',
  'billing',
  'gallery',
  'membership',
  'product',
  'rental',
  'ticketing',
] as const;

/** Správa entitlementů modulů organizace (EPIC-18 Fáze 3). Opt-out model. */
@Injectable()
export class ModulesService {
  constructor(
    private readonly context: TenantContextService,
    private readonly authz: AuthzService,
    private readonly audit: AuditService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  private repo(): Repository<OrganizationModule> {
    return this.context.manager.getRepository(OrganizationModule);
  }

  /**
   * Řízené moduly/funkce + stav pro aktivní org (chybí řádek = povoleno a zapnuto).
   * Zároveň líně vyhodnotí předplatné (konec zkušební doby, splatnost).
   */
  async list(): Promise<ModuleState[]> {
    await this.subscriptions.get(this.context.tenantId!);
    const rows = await this.repo().find();
    const byKey = new Map(rows.map((r) => [r.moduleKey, r]));
    const overrides = await this.overrides();
    return [...CONTROLLED_MODULES].map((moduleKey) => {
      const row = byKey.get(moduleKey);
      const ownerState = row?.state ?? 'active';
      const allowed = row?.allowed ?? true;
      return {
        moduleKey,
        kind: FEATURE_KEYS.has(moduleKey) ? 'feature' : 'module',
        state: allowed && ownerState === 'active' ? 'active' : 'inactive',
        ownerState,
        allowed,
        lock: allowed
          ? null
          : overrides[moduleKey] === 'disabled'
            ? 'disabled_by_platform'
            : 'not_in_plan',
      };
    });
  }

  /** Výjimky superadmina pro aktivní firmu (platformní tabulka bez RLS). */
  private async overrides(): Promise<Record<string, string>> {
    const rows = await this.context.manager.query(
      `SELECT entitlement_overrides FROM tenant_subscriptions WHERE tenant_id = $1`,
      [this.context.tenantId],
    );
    return (rows[0]?.entitlement_overrides as Record<string, string>) ?? {};
  }

  /** Ověří stav řízeného modulu v aktivní organizaci; core moduly jsou vždy aktivní. */
  async isActive(moduleKey: string): Promise<boolean> {
    if (!CONTROLLED_MODULES.has(moduleKey)) return true;
    const row = await this.repo().findOne({ where: { moduleKey } });
    return row?.state !== 'inactive' && row?.allowed !== false;
  }

  /** Zapne/vypne modul pro aktivní org (upsert) + invaliduje authz cache. */
  async setState(moduleKey: string, state: 'active' | 'inactive'): Promise<ModuleState> {
    if (!CONTROLLED_MODULES.has(moduleKey)) {
      throw new BadRequestException('Neznámý nebo neřízený modul');
    }
    const repo = this.repo();
    let row = await repo.findOne({ where: { moduleKey } });
    // Co platforma (předplatné / superadmin) nepovolila, vlastník nepřepne.
    if (row && !row.allowed) {
      const lock = (await this.overrides())[moduleKey] === 'disabled';
      throw new ForbiddenException(
        lock
          ? 'Modul vypnul správce platformy Tagery.'
          : 'Modul není ve vašem předplatném. Pro zapnutí požádejte o vyšší úroveň.',
      );
    }
    const prev = row?.state ?? 'active'; // chybí řádek = byl aktivní
    if (!row) {
      row = repo.create({ tenantId: this.context.tenantId, moduleKey, state });
    } else {
      row.state = state;
    }
    await repo.save(row);
    this.authz.invalidateModules(this.context.tenantId!);
    await this.audit.record({
      action: 'module.entitlement_changed',
      targetType: 'module',
      targetId: moduleKey,
      before: { state: prev },
      after: { state },
    });
    return (await this.list()).find((m) => m.moduleKey === moduleKey)!;
  }
}
