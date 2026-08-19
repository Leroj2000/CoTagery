import { BadRequestException, Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TenantContextService } from '../tenancy/tenant-context.service';
import { OrganizationModule } from './entities/organization-module.entity';
import { AuthzService, CONTROLLED_MODULES } from './authz.service';

export interface ModuleState {
  moduleKey: string;
  state: 'active' | 'inactive';
}

/** Správa entitlementů modulů organizace (EPIC-18 Fáze 3). Opt-out model. */
@Injectable()
export class ModulesService {
  constructor(
    private readonly context: TenantContextService,
    private readonly authz: AuthzService,
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

  /** Zapne/vypne modul pro aktivní org (upsert) + invaliduje authz cache. */
  async setState(moduleKey: string, state: 'active' | 'inactive'): Promise<ModuleState> {
    if (!CONTROLLED_MODULES.has(moduleKey)) {
      throw new BadRequestException('Neznámý nebo neřízený modul');
    }
    const repo = this.repo();
    let row = await repo.findOne({ where: { moduleKey } });
    if (!row) {
      row = repo.create({ tenantId: this.context.tenantId, moduleKey, state });
    } else {
      row.state = state;
    }
    await repo.save(row);
    this.authz.invalidateModules(this.context.tenantId!);
    return { moduleKey, state };
  }
}
