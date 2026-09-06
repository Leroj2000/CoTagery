import { BadRequestException, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TenantContextService } from '../tenancy/tenant-context.service';
import { OrganizationModule } from './entities/organization-module.entity';
import { AuthzService, CONTROLLED_MODULES } from './authz.service';
import { AuditService } from './audit.service';

export interface ModuleState {
  moduleKey: string;
  state: 'active' | 'inactive';
}

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
  ) {}

  private repo(): Repository<OrganizationModule> {
    return this.context.manager.getRepository(OrganizationModule);
  }

  /** Řízené moduly + jejich stav pro aktivní org (chybí řádek = active). */
  async list(): Promise<ModuleState[]> {
    const rows = await this.repo().find();
    const byKey = new Map(rows.map((r) => [r.moduleKey, r.state]));
    return [...CONTROLLED_MODULES].sort().map((moduleKey) => ({
      moduleKey,
      state: byKey.get(moduleKey) ?? 'active',
    }));
  }

  /** Ověří stav řízeného modulu v aktivní organizaci; core moduly jsou vždy aktivní. */
  async isActive(moduleKey: string): Promise<boolean> {
    if (!CONTROLLED_MODULES.has(moduleKey)) return true;
    const row = await this.repo().findOne({ where: { moduleKey } });
    return row?.state !== 'inactive';
  }

  /** Zapne/vypne modul pro aktivní org (upsert) + invaliduje authz cache. */
  async setState(moduleKey: string, state: 'active' | 'inactive'): Promise<ModuleState> {
    if (!CONTROLLED_MODULES.has(moduleKey)) {
      throw new BadRequestException('Neznámý nebo neřízený modul');
    }
    const repo = this.repo();
    let row = await repo.findOne({ where: { moduleKey } });
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
    return { moduleKey, state };
  }
}
