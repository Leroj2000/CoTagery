import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { LessThanOrEqual, Repository } from 'typeorm';
import { TenantContextService } from '../../core/tenancy/tenant-context.service';
import { STORAGE, type StoragePort } from '../../core/storage/storage.port';
import { WebhookService } from '../../core/webhooks/webhook.service';
import { Location } from '../../core/domain/entities/location.entity';
import { Person } from '../../core/domain/entities/person.entity';
import { Tenant } from '../../core/domain/entities/tenant.entity';
import { DigitalObject } from '../../core/domain/entities/digital-object.entity';
import { DataCarriersService } from '../../core/domain/carriers/data-carriers.service';
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
import { Issue } from './entities/issue.entity';
import { toCsv, csvToObjects } from './csv.logic';
import { randomUUID } from 'node:crypto';
import { generatePublicCode } from '../../core/domain/public-code';
import type {
  AddServiceDto,
  CreateAssetDto,
  CreateReservationDto,
  PerformMovementDto,
} from './dto/asset.dto';

/** Výsledek Global Scanu: co jsme naskenovali a co s tím jde dělat. */
export interface ScanResult {
  found: boolean;
  code: string;
  carrier?: {
    id: string;
    publicCode: string;
    externalCode: string | null;
    origin: 'native' | 'adopted';
    carrierType: string;
  };
  asset?: (Asset & { actions: MovementType[] }) | null;
  object?: { id: string; moduleType: string; slug: string } | null;
  primaryAction?: MovementType | null;
  /** Rozřešená jména pro kartu po skenu (Patří do / Kde je / Má ji). */
  context?: {
    homeName: string | null;
    holderName: string | null;
    responsibleName: string | null;
  } | null;
}

@Injectable()
export class AssetService {
  constructor(
    private readonly context: TenantContextService,
    @Inject(STORAGE) private readonly storage: StoragePort,
    private readonly webhooks: WebhookService,
    private readonly carriers: DataCarriersService,
  ) {}

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
   * Kontextová primární akce po skenu (Global Scan router):
   * má-li věc někdo v držení → VRÁTIT; v servisu → vrátit ze servisu; jinak PŘEDAT.
   * Vždy z množiny povolených akcí daného stavu.
   */
  primaryActionFor(asset: Asset, actions: MovementType[]): MovementType | null {
    let candidate: MovementType | null = null;
    if (asset.currentHolderType === 'person') candidate = 'return';
    else if (asset.status === 'service') candidate = 'service_return';
    else if (asset.status === 'available' || asset.status === 'reserved') candidate = 'loan';
    if (candidate && actions.includes(candidate)) return candidate;
    return actions[0] ?? null;
  }

  /**
   * Global Scan: naskenovaný kód (náš public_code NEBO adoptovaný external_code)
   * → věc + odvozený stav + kontextová akce. Tenant kontext (interní skener),
   * veřejný resolver se nepoužívá.
   */
  async scanLookup(rawCode: string): Promise<ScanResult> {
    const code = rawCode.trim();
    if (!code) throw new BadRequestException('Prázdný kód');

    const carrier = await this.carriers.findByCode(code);
    if (!carrier) return { found: false, code };

    const carrierInfo = {
      id: carrier.id,
      publicCode: carrier.publicCode,
      externalCode: carrier.externalCode,
      origin: carrier.origin,
      carrierType: carrier.carrierType,
    };

    if (!carrier.digitalObjectId) {
      // Nepřiřazený pool kód – zatím bez objektu/věci.
      return { found: true, code, carrier: carrierInfo, asset: null, object: null, primaryAction: null };
    }

    const object = await this.repo(DigitalObject).findOne({ where: { id: carrier.digitalObjectId } });
    const asset = await this.getByObject(carrier.digitalObjectId);

    if (!asset) {
      // Objekt existuje, ale není to „věc" (např. členská karta / produkt).
      return {
        found: true,
        code,
        carrier: carrierInfo,
        asset: null,
        object: object ? { id: object.id, moduleType: object.moduleType, slug: object.slug } : null,
        primaryAction: null,
      };
    }

    const actions = this.actionsFor(asset);
    return {
      found: true,
      code,
      carrier: carrierInfo,
      asset: { ...asset, actions },
      object: object ? { id: object.id, moduleType: object.moduleType, slug: object.slug } : null,
      primaryAction: this.primaryActionFor(asset, actions),
      context: await this.resolveContext(asset),
    };
  }

  /** Rozřeší jména držitele / domovské lokace / odpovědné osoby pro scan kartu. */
  private async resolveContext(asset: Asset): Promise<ScanResult['context']> {
    const locName = async (id: string | null): Promise<string | null> =>
      id ? (await this.repo(Location).findOne({ where: { id } }))?.name ?? null : null;
    const personName = async (id: string | null): Promise<string | null> =>
      id ? (await this.repo(Person).findOne({ where: { id } }))?.name ?? null : null;
    const assetName = async (id: string | null): Promise<string | null> =>
      id ? (await this.repo(Asset).findOne({ where: { id } }))?.name ?? null : null;

    let holderName: string | null = null;
    if (asset.currentHolderType === 'person') holderName = await personName(asset.currentHolderId);
    else if (asset.currentHolderType === 'location') holderName = await locName(asset.currentHolderId);
    else if (asset.currentHolderType === 'asset') holderName = await assetName(asset.currentHolderId);

    return {
      homeName: await locName(asset.homeLocationId),
      holderName,
      responsibleName: await personName(asset.responsiblePersonId),
    };
  }

  /** Politika tenanta: vyžadovat foto při vrácení? */
  async requireReturnPhoto(): Promise<boolean> {
    const tenant = await this.repo(Tenant).findOne({ where: { id: this.context.tenantId } });
    return tenant?.settings?.requireReturnPhoto === true;
  }

  /** ID posledního pohybu věci (pro navázání médií po vrácení). */
  async lastMovementId(assetId: string): Promise<string | null> {
    const mv = await this.repo(Movement).findOne({
      where: { assetId },
      order: { createdAt: 'DESC' },
    });
    return mv?.id ?? null;
  }

  /**
   * Provede pohyb: vyhodnotí stavový automat, zapíše NEMĚNNÝ Movement do
   * ledgeru a přepočítá odvozený stav assetu. Vše v tenant transakci (RLS).
   * `skipReturnPhotoCheck` použije jen atomický return-with-photo endpoint.
   */
  async performMovement(
    assetId: string,
    dto: PerformMovementDto,
    opts?: { skipReturnPhotoCheck?: boolean },
  ): Promise<Asset> {
    // Politika: vrácení bez fotky odmítni (nejde obejít generickým endpointem).
    if (dto.type === 'return' && !opts?.skipReturnPhotoCheck && (await this.requireReturnPhoto())) {
      throw new BadRequestException('Vrácení vyžaduje fotku stavu (politika tenanta)');
    }

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
    const saved = await this.repo(Asset).save(asset);

    await this.webhooks.emit('movement.created', {
      assetId: asset.id,
      assetName: asset.name,
      type: dto.type,
      toType: after.holderType,
      toId: after.holderId,
      status: after.status,
    });
    return saved;
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

  // --- Hromadný výdej (bulk movement) ---
  /** Provede stejný pohyb nad více věcmi; vrátí souhrn OK / chyb. */
  async bulkMovement(
    assetIds: string[],
    dto: PerformMovementDto,
  ): Promise<{ ok: number; failed: { assetId: string; error: string }[] }> {
    const failed: { assetId: string; error: string }[] = [];
    let ok = 0;
    for (const id of assetIds) {
      try {
        await this.performMovement(id, dto);
        ok++;
      } catch (e) {
        failed.push({ assetId: id, error: e instanceof Error ? e.message : 'chyba' });
      }
    }
    return { ok, failed };
  }

  // --- CSV export / import ---
  /** Export všech věcí do CSV (názvy kategorie/home lokace/holdera). */
  async exportCsv(): Promise<string> {
    const [assets, locations, people] = await Promise.all([
      this.repo(Asset).find({ order: { createdAt: 'DESC' } }),
      this.repo(Location).find(),
      this.repo(Person).find(),
    ]);
    const locName = new Map(locations.map((l) => [l.id, l.name]));
    const perName = new Map(people.map((p) => [p.id, p.name]));
    const holder = (a: Asset): string =>
      a.currentHolderType === 'person'
        ? (perName.get(a.currentHolderId ?? '') ?? '')
        : (locName.get(a.currentHolderId ?? '') ?? '');

    const header = [
      'name',
      'category',
      'manufacturer',
      'model',
      'serialNumber',
      'inventoryNumber',
      'status',
      'homeLocation',
      'holder',
    ];
    const rows = assets.map((a) => [
      a.name,
      a.category ?? '',
      a.manufacturer ?? '',
      a.model ?? '',
      a.serialNumber ?? '',
      a.inventoryNumber ?? '',
      a.status,
      locName.get(a.homeLocationId ?? '') ?? '',
      holder(a),
    ]);
    return toCsv([header, ...rows]);
  }

  /**
   * Import věcí z CSV. Sloupce (hlavička): name (povinné), category, manufacturer,
   * model, serialNumber, inventoryNumber, homeLocation. Kategorie i home lokace se
   * dohledají podle názvu, nebo založí (find-or-create). Vrací souhrn.
   */
  async importCsv(csv: string): Promise<{ created: number; failed: { row: number; error: string }[] }> {
    const objs = csvToObjects(csv);
    const catRepo = this.repo(Category);
    const locRepo = this.repo(Location);
    const cats = await catRepo.find();
    const locs = await locRepo.find();
    const catByName = new Map(cats.map((c) => [c.name.toLowerCase(), c]));
    const locByName = new Map(locs.map((l) => [l.name.toLowerCase(), l]));

    const failed: { row: number; error: string }[] = [];
    let created = 0;
    for (let i = 0; i < objs.length; i++) {
      const o = objs[i];
      const name = o.name?.trim();
      if (!name) {
        failed.push({ row: i + 2, error: 'chybí name' });
        continue;
      }
      try {
        let categoryId: string | undefined;
        if (o.category) {
          let cat = catByName.get(o.category.toLowerCase());
          if (!cat) {
            cat = await catRepo.save(
              catRepo.create({ tenantId: this.context.tenantId, name: o.category, color: null }),
            );
            catByName.set(cat.name.toLowerCase(), cat);
          }
          categoryId = cat.id;
        }
        let homeLocationId: string | undefined;
        const locName = o.homelocation || o.homeLocation;
        if (locName) {
          let loc = locByName.get(locName.toLowerCase());
          if (!loc) {
            loc = await locRepo.save(locRepo.create({ tenantId: this.context.tenantId, name: locName }));
            locByName.set(loc.name.toLowerCase(), loc);
          }
          homeLocationId = loc.id;
        }
        await this.create({
          name,
          categoryId,
          manufacturer: o.manufacturer || undefined,
          model: o.model || undefined,
          serialNumber: o.serialnumber || o.serialNumber || undefined,
          inventoryNumber: o.inventorynumber || o.inventoryNumber || undefined,
          homeLocationId,
        });
        created++;
      } catch (e) {
        failed.push({ row: i + 2, error: e instanceof Error ? e.message : 'chyba' });
      }
    }
    return { created, failed };
  }

  // --- Fotografie věci ---
  async setPhoto(assetId: string, buffer: Buffer, mime: string): Promise<Asset> {
    const asset = await this.get(assetId);
    const key = `assets/${this.context.tenantId}/${assetId}/${randomUUID()}`;
    await this.storage.put(key, buffer, mime);
    asset.photoKey = key;
    asset.photoMime = mime;
    return this.repo(Asset).save(asset);
  }

  async getPhoto(assetId: string): Promise<{ buffer: Buffer; mime: string }> {
    const asset = await this.get(assetId);
    if (!asset.photoKey) throw new NotFoundException('Věc nemá fotografii');
    return { buffer: await this.storage.get(asset.photoKey), mime: asset.photoMime ?? 'image/jpeg' };
  }

  // --- Nahlášení problému / poškození ---
  listIssues(assetId: string): Promise<Issue[]> {
    return this.repo(Issue).find({ where: { assetId }, order: { createdAt: 'DESC' } });
  }

  async reportIssue(
    assetId: string,
    dto: { kind: Issue['kind']; description: string; reportedById?: string },
  ): Promise<Issue> {
    await this.get(assetId);
    const repo = this.repo(Issue);
    const issue = await repo.save(
      repo.create({
        tenantId: this.context.tenantId,
        assetId,
        reportedById: dto.reportedById ?? null,
        kind: dto.kind,
        description: dto.description,
        status: 'open',
      }),
    );
    await this.webhooks.emit('issue.reported', {
      assetId,
      issueId: issue.id,
      kind: dto.kind,
      description: dto.description,
    });
    return issue;
  }

  async resolveIssue(issueId: string): Promise<Issue> {
    const repo = this.repo(Issue);
    const issue = await repo.findOne({ where: { id: issueId } });
    if (!issue) throw new NotFoundException('Hlášení neexistuje');
    issue.status = 'resolved';
    issue.resolvedAt = new Date();
    return repo.save(issue);
  }

  // --- „Vyžaduje pozornost" (akční agregace) ---
  /** Souhrn věcí vyžadujících akci: po termínu, nepotvrzeno, problémy, servis. */
  async attention(): Promise<{
    overdue: Asset[];
    pendingConfirmations: Movement[];
    openIssues: Issue[];
    dueServices: ServiceRecord[];
  }> {
    const now = new Date();
    const [assets, pendingConfirmations, openIssues, dueServices] = await Promise.all([
      this.repo(Asset).find({ where: { status: 'loaned' } }),
      this.pendingConfirmations(),
      this.repo(Issue).find({ where: { status: 'open' }, order: { createdAt: 'DESC' } }),
      this.dueServices(30),
    ]);
    const overdue = assets.filter((a) => a.dueAt && a.dueAt.getTime() < now.getTime());
    return { overdue, pendingConfirmations, openIssues, dueServices };
  }
}
