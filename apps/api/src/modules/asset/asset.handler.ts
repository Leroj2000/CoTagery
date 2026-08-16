import { Injectable, OnModuleInit } from '@nestjs/common';
import type { ModuleType } from '@tagery/shared';
import {
  ModuleRegistry,
  type ModuleHandler,
  type ScanResponse,
} from '../../core/domain/module-handler';
import type { DigitalObject } from '../../core/domain/entities/digital-object.entity';
import { AssetService } from './asset.service';

/**
 * Handler pro sken assetu (Fáze A). Vrací stav věci + nabídku kontextových akcí
 * (věc → co s ní lze udělat) – základ pro mobilní „SCAN → akce" UX.
 */
@Injectable()
export class AssetHandler implements ModuleHandler, OnModuleInit {
  readonly moduleType: ModuleType = 'asset';

  constructor(
    private readonly registry: ModuleRegistry,
    private readonly assets: AssetService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async handleScan(object: DigitalObject): Promise<ScanResponse> {
    const asset = await this.assets.getByObject(object.id);
    if (!asset) {
      return { kind: 'json', body: { type: 'asset', asset: null } };
    }
    return {
      kind: 'json',
      body: {
        type: 'asset',
        asset: {
          name: asset.name,
          status: asset.status,
          holderType: asset.currentHolderType,
          holderId: asset.currentHolderId,
          responsiblePersonId: asset.responsiblePersonId,
          dueAt: asset.dueAt,
        },
        actions: this.assets.actionsFor(asset),
      },
    };
  }
}
