import { Injectable, OnModuleInit } from '@nestjs/common';
import type { ModuleType } from '@tagery/shared';
import {
  ModuleRegistry,
  type ModuleHandler,
  type ScanResponse,
} from '../../core/domain/module-handler';
import type { DigitalObject } from '../../core/domain/entities/digital-object.entity';
import type { DataCarrier } from '../../core/domain/entities/data-carrier.entity';
import { MembershipService } from './membership.service';

/**
 * Handler pro sken členské karty (EPIC-16). Vrací self-service pohled: člen,
 * tier, platnost a benefity. Kartu najde přes naskenovaný nosič.
 */
@Injectable()
export class MembershipHandler implements ModuleHandler, OnModuleInit {
  readonly moduleType: ModuleType = 'membership';

  constructor(
    private readonly registry: ModuleRegistry,
    private readonly memberships: MembershipService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async handleScan(_object: DigitalObject, carrier: DataCarrier): Promise<ScanResponse> {
    const card = await this.memberships.cardByCarrier(carrier.id);
    if (!card) {
      return { kind: 'json', body: { type: 'membership', card: null } };
    }
    const view = await this.memberships.cardView(card);
    return { kind: 'json', body: { type: 'membership', card: view } };
  }
}
