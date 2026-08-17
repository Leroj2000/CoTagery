import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LessThanOrEqual, Repository } from 'typeorm';
import { TenantContextService } from '../../core/tenancy/tenant-context.service';
import { DigitalObject } from '../../core/domain/entities/digital-object.entity';
import { Asset } from './entities/asset.entity';
import { Movement } from './entities/movement.entity';
import { ServiceRecord } from './entities/service-record.entity';
import { Reservation } from './entities/reservation.entity';
import { Category } from './entities/category.entity';
import {
  applyMovement,
  availableActions,
  initialState,
  MovementError,
  type AssetState,
  type MovementType,
} from './movement.logic';
import { wouldCreateCycle } from './nesting.logic';
import { generatePublicCode } from '../../core/domain/public-code';
import type {
  AddServiceDto,
  CreateAssetDto,
  CreateReservationDto,
  PerformMovementDto,
} from './dto/asset.dto';

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
    // Kategorie z číselníku: přednost má categoryId (doplní denorm. název).
    const categoryId: string | null = dto.categoryId ?? null;
    let categoryName: string | null = dto.category ?? null;
    if (categoryId) {
      const cat = await this.repo(Category).findOne({ where: { id: categoryId } });
      if (!cat) throw new NotFoundException('Kategorie neexistuje');
      categoryName = cat.name;
    }

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
        category: categoryName,
        categoryId,
        manufacturer: dto.manufacturer ?? null,
        model: dto.model ?? null,
        serialNumber: dto.serialNumber ?? null,
        inventoryNumber: dto.inventoryNumber ?? null,
        homeLocationId: dto.homeLocationId ?? null,
        canContainAssets: dto.canContainAssets ?? false,
        parentAssetId: null,
        status: init.status,
        currentHolderType: init.holderType,
        currentHolderId: init.holderId,
        responsiblePersonId: init.responsiblePersonId,
        dueAt: init.dueAt,
      }),
    );
  }

  // --- Asset nesting (§14): věc ve věci ---

  /** Obsah kontejneru (věci uložené přímo v něm). */
  listContents(containerId: string): Promise<Asset[]> {
    return this.repo(Asset).find({ where: { parentAssetId: containerId }, order: { name: 'ASC' } });
  }

  /** Vloží věc do kontejneru. Kontejner musí být `canContainAssets`; ochrana proti cyklům. */
  async putInto(containerId: string, childId: string): Promise<Asset> {
    const container = await this.get(containerId);
    if (!container.canContainAssets) {
      throw new BadRequestException('Cílová věc není kontejner');
    }
    const child = await this.get(childId);

    // Ochrana proti cyklu: postav mapu rodičů a ověř.
    const all = await this.repo(Asset).find();
    const parentOf = new Map(all.map((a) => [a.id, a.parentAssetId]));
    if (wouldCreateCycle(childId, containerId, parentOf)) {
      throw new BadRequestException('Nelze vložit věc do sebe ani do svého potomka');
    }

    child.parentAssetId = containerId;
    return this.repo(Asset).save(child);
  }

  /** Vyjme věc z kontejneru. */
  async removeFromContainer(childId: string): Promise<Asset> {
    const child = await this.get(childId);
    child.parentAssetId = null;
    return this.repo(Asset).save(child);
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

    // Potvrzení převzetí (§8) jen u předání do držení osoby.
    const confirmable = ['loan', 'assign', 'handover'].includes(dto.type);
    const confirmation = dto.requireConfirmation && confirmable ? 'pending' : 'none';

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
        confirmation,
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

  // --- Potvrzení převzetí (§8) ---
  async confirmMovement(movementId: string): Promise<Movement> {
    const repo = this.repo(Movement);
    const mv = await repo.findOne({ where: { id: movementId } });
    if (!mv) throw new NotFoundException('Pohyb neexistuje');
    if (mv.confirmation !== 'pending') {
      throw new BadRequestException('Pohyb nevyžaduje potvrzení nebo už je potvrzený');
    }
    mv.confirmation = 'confirmed';
    mv.confirmedAt = new Date();
    return repo.save(mv);
  }

  /** Nepotvrzená předání (pro „vyžaduje pozornost"). */
  pendingConfirmations(): Promise<Movement[]> {
    return this.repo(Movement).find({
      where: { confirmation: 'pending' },
      order: { createdAt: 'DESC' },
    });
  }

  // --- Servis / revize (§17) ---
  listServices(assetId: string): Promise<ServiceRecord[]> {
    return this.repo(ServiceRecord).find({ where: { assetId }, order: { createdAt: 'DESC' } });
  }

  async addService(assetId: string, dto: AddServiceDto): Promise<ServiceRecord> {
    await this.get(assetId);
    const repo = this.repo(ServiceRecord);
    return repo.save(
      repo.create({
        tenantId: this.context.tenantId,
        assetId,
        kind: dto.kind,
        performedAt: dto.performedAt ? new Date(dto.performedAt) : null,
        nextDueAt: dto.nextDueAt ? new Date(dto.nextDueAt) : null,
        provider: dto.provider ?? null,
        cost: dto.cost ?? null,
        note: dto.note ?? null,
      }),
    );
  }

  /** Servisní záznamy s termínem do `days` dní (blížící se servis/revize). */
  dueServices(days = 30): Promise<ServiceRecord[]> {
    const until = new Date(Date.now() + Math.max(0, days) * 24 * 60 * 60 * 1000);
    return this.repo(ServiceRecord).find({
      where: { nextDueAt: LessThanOrEqual(until) },
      order: { nextDueAt: 'ASC' },
    });
  }

  // --- Rezervace / požadavky (§15) ---
  listReservations(): Promise<Reservation[]> {
    return this.repo(Reservation).find({ order: { createdAt: 'DESC' }, take: 500 });
  }

  async createReservation(dto: CreateReservationDto): Promise<Reservation> {
    await this.get(dto.assetId);
    const repo = this.repo(Reservation);
    return repo.save(
      repo.create({
        tenantId: this.context.tenantId,
        assetId: dto.assetId,
        requestedById: dto.requestedById ?? null,
        fromAt: dto.fromAt ? new Date(dto.fromAt) : null,
        toAt: dto.toAt ? new Date(dto.toAt) : null,
        purpose: dto.purpose ?? null,
        status: 'pending',
      }),
    );
  }

  async setReservationStatus(
    id: string,
    status: 'approved' | 'rejected' | 'cancelled',
  ): Promise<Reservation> {
    const repo = this.repo(Reservation);
    const res = await repo.findOne({ where: { id } });
    if (!res) throw new NotFoundException('Rezervace neexistuje');
    res.status = status;
    return repo.save(res);
  }
}
