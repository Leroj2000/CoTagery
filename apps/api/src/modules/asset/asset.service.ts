import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TenantContextService } from '../../core/tenancy/tenant-context.service';
import { DigitalObject } from '../../core/domain/entities/digital-object.entity';
import { Asset } from './entities/asset.entity';
import { Movement } from './entities/movement.entity';
import {
  applyMovement,
  availableActions,
  initialState,
  MovementError,
  type AssetState,
  type MovementType,
} from './movement.logic';
import { generatePublicCode } from '../../core/domain/public-code';
import type { CreateAssetDto, PerformMovementDto } from './dto/asset.dto';

@Injectable()
export class AssetService {
  constructor(private readonly context: TenantContextService) {}

  private repo<T extends object>(entity: { new (): T }): Repository<T> {
    return this.context.manager.getRepository(entity);
  }

  list(): Promise<Asset[]> {
    return this.repo(Asset).find({ order: { createdAt: 'DESC' }, take: 500 });
  }

  async get(id: string): Promise<Asset> {
    const asset = await this.repo(Asset).findOne({ where: { id } });
    if (!asset) throw new NotFoundException('Asset neexistuje');
    return asset;
  }

  getByObject(objectId: string): Promise<Asset | null> {
    return this.repo(Asset).findOne({ where: { digitalObjectId: objectId } });
  }

  /** Založí asset + jeho DigitalObject (nosič se přidá zvlášť přes /objects). */
  async create(dto: CreateAssetDto): Promise<Asset> {
    const objectRepo = this.repo(DigitalObject);
    const object = await objectRepo.save(
      objectRepo.create({
        tenantId: this.context.tenantId,
        moduleType: 'asset',
        slug: `asset-${generatePublicCode(8).toLowerCase()}`,
        status: 'active',
        metadata: {},
      }),
    );

    const init = initialState(dto.homeLocationId ?? null);
    return this.repo(Asset).save(
      this.repo(Asset).create({
        tenantId: this.context.tenantId,
        digitalObjectId: object.id,
        name: dto.name,
        category: dto.category ?? null,
        manufacturer: dto.manufacturer ?? null,
        model: dto.model ?? null,
        serialNumber: dto.serialNumber ?? null,
        inventoryNumber: dto.inventoryNumber ?? null,
        homeLocationId: dto.homeLocationId ?? null,
        status: init.status,
        currentHolderType: init.holderType,
        currentHolderId: init.holderId,
        responsiblePersonId: init.responsiblePersonId,
        dueAt: init.dueAt,
      }),
    );
  }

  listMovements(assetId: string): Promise<Movement[]> {
    return this.repo(Movement).find({ where: { assetId }, order: { createdAt: 'DESC' } });
  }

  /** Akce nabídnuté po skenu podle stavu (věc → co s ní). */
  actionsFor(asset: Asset): MovementType[] {
    return availableActions(asset.status);
  }

  /**
   * Provede pohyb: vyhodnotí stavový automat, zapíše NEMĚNNÝ Movement do
   * ledgeru a přepočítá odvozený stav assetu. Vše v tenant transakci (RLS).
   */
  async performMovement(assetId: string, dto: PerformMovementDto): Promise<Asset> {
    const asset = await this.get(assetId);

    const before: AssetState = {
      status: asset.status,
      holderType: asset.currentHolderType,
      holderId: asset.currentHolderId,
      responsiblePersonId: asset.responsiblePersonId,
      dueAt: asset.dueAt,
    };

    let after: AssetState;
    try {
      after = applyMovement(before, {
        type: dto.type,
        toType: dto.toType ?? null,
        toId: dto.toId ?? null,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        homeLocationId: asset.homeLocationId,
      });
    } catch (err) {
      if (err instanceof MovementError) throw new BadRequestException(err.message);
      throw err;
    }

    // Append-only ledger (nikdy se needituje).
    await this.repo(Movement).save(
      this.repo(Movement).create({
        tenantId: this.context.tenantId,
        assetId: asset.id,
        type: dto.type,
        fromType: before.holderType,
        fromId: before.holderId,
        toType: after.holderType,
        toId: after.holderId,
        actorPersonId: dto.actorPersonId ?? null,
        dueAt: after.dueAt,
        note: dto.note ?? null,
      }),
    );

    // Odvozený stav na assetu.
    asset.status = after.status;
    asset.currentHolderType = after.holderType;
    asset.currentHolderId = after.holderId;
    asset.responsiblePersonId = after.responsiblePersonId;
    asset.dueAt = after.dueAt;
    return this.repo(Asset).save(asset);
  }
}
