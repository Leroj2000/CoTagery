import { createHash, randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TenantContextService } from '../../core/tenancy/tenant-context.service';
import { STORAGE, type StoragePort } from '../../core/storage/storage.port';
import { AuditService } from '../../core/rbac/audit.service';
import { AuthzService } from '../../core/rbac/authz.service';
import type { RequestUser } from '../../core/auth/jwt-auth.guard';
import { Tenant } from '../../core/domain/entities/tenant.entity';
import { Asset } from './entities/asset.entity';
import { AssetPurchase } from './entities/asset-purchase.entity';
import { AssetDocument, type AssetDocumentType } from './entities/asset-document.entity';
import { AssetWarranty } from './entities/asset-warranty.entity';
import {
  WARRANTY_EXPIRING_DAYS,
  addDays,
  computePrice,
  decodeFileName,
  defaultStartBasis,
  isIsoDate,
  rebaseWarranty,
  warrantyStartFor,
  type WarrantyStartBasis,
  tenantIsVatPayer,
  tenantVatRate,
  todayInPrague,
  warrantyEnd,
  warrantyStatus,
  type WarrantyStatus,
} from './purchase.logic';
import type { UpsertPurchaseDto, WarrantyDto } from './dto/purchase.dto';

/** Nastavení DPH firmy pro formulář. */
export interface VatSettings {
  payer: boolean;
  defaultRate: number;
}

export interface PurchaseView {
  purchase: AssetPurchase | null;
  documents: AssetDocument[];
  vat: VatSettings;
}

export interface WarrantyView extends AssetWarranty {
  status: WarrantyStatus;
  document: { id: string; fileName: string | null; mime: string } | null;
}

export interface ExpiringWarranty extends WarrantyView {
  assetName: string;
}

/** Vyřazené/ztracené položky už na konec záruky neupozorňují. */
const INACTIVE_STATUSES = ['retired', 'lost'];

/**
 * Pořízení, doklady a záruky položky. Tenant-scoped (RLS). Ceny a faktury čte
 * jen `asset.purchase.view`; záruky (bez cen) vidí každý s `asset.item.view`.
 */
@Injectable()
export class PurchaseService {
  constructor(
    private readonly context: TenantContextService,
    @Inject(STORAGE) private readonly storage: StoragePort,
    private readonly audit: AuditService,
    private readonly authz: AuthzService,
  ) {}

  private repo<T extends object>(entity: { new (): T }): Repository<T> {
    return this.context.manager.getRepository(entity);
  }

  async vatSettings(): Promise<VatSettings> {
    const tenant = await this.repo(Tenant).findOne({ where: { id: this.context.tenantId } });
    return {
      payer: tenantIsVatPayer(tenant?.settings),
      defaultRate: tenantVatRate(tenant?.settings),
    };
  }

  private async assertAsset(assetId: string): Promise<Asset> {
    const asset = await this.repo(Asset).findOne({ where: { id: assetId } });
    if (!asset) throw new NotFoundException('Položka neexistuje');
    return asset;
  }

  // --- Pořízení ---

  async purchase(assetId: string): Promise<PurchaseView> {
    await this.assertAsset(assetId);
    const purchase = await this.repo(AssetPurchase).findOne({ where: { assetId } });
    const documents = await this.documents(assetId);
    return { purchase, documents, vat: await this.vatSettings() };
  }

  async upsertPurchase(assetId: string, dto: UpsertPurchaseDto): Promise<PurchaseView> {
    await this.assertAsset(assetId);
    const repo = this.repo(AssetPurchase);
    const existing = await repo.findOne({ where: { assetId } });
    const before = existing ? { ...existing } : null;
    const row =
      existing ??
      repo.create({
        tenantId: this.context.tenantId,
        assetId,
        currency: 'CZK',
        vatPayer: false,
        condition: 'new',
      });

    if (dto.purchasedOn !== undefined) {
      if (dto.purchasedOn && !isIsoDate(dto.purchasedOn))
        throw new BadRequestException('Neplatné datum pořízení');
      row.purchasedOn = dto.purchasedOn || null;
    }
    if (dto.condition !== undefined) row.condition = dto.condition;
    if (dto.inServiceOn !== undefined) {
      if (dto.inServiceOn && !isIsoDate(dto.inServiceOn))
        throw new BadRequestException('Neplatné datum uvedení do provozu');
      row.inServiceOn = dto.inServiceOn || null;
    }
    if (dto.supplier !== undefined) row.supplier = dto.supplier?.trim() || null;
    if (dto.documentNumber !== undefined) row.documentNumber = dto.documentNumber?.trim() || null;
    if (dto.note !== undefined) row.note = dto.note?.trim() || null;

    if (dto.price !== undefined || dto.vatRate !== undefined) {
      const vat = await this.vatSettings();
      // Plátce zadává standardně bez DPH, neplátce s DPH; sazba podle firmy.
      const includesVat = dto.priceIncludesVat ?? !vat.payer;
      const vatRate = dto.vatRate !== undefined ? dto.vatRate : vat.payer ? vat.defaultRate : null;
      const amount =
        dto.price !== undefined
          ? dto.price
          : includesVat
            ? (row.priceGross ?? null)
            : (row.priceNet ?? null);
      Object.assign(row, computePrice({ amount, includesVat, vatRate }));
      row.vatPayer = vat.payer;
    }

    const saved = await repo.save(row);
    if (
      saved.purchasedOn !== (before?.purchasedOn ?? null) ||
      saved.inServiceOn !== (before?.inServiceOn ?? null) ||
      saved.condition !== (before?.condition ?? 'new')
    ) {
      await this.rebaseWarranties(assetId, saved);
    }
    await this.audit.record({
      action: 'asset.purchase.update',
      targetType: 'asset',
      targetId: assetId,
      before: before as unknown as Record<string, unknown> | null,
      after: saved as unknown as Record<string, unknown>,
    });
    return this.purchase(assetId);
  }

  /**
   * Po změně dat pořízení posune záruky, jejichž začátek se z pořízení odvozuje
   * (od pořízení / od uvedení do provozu). Ručně zadané začátky nechá být.
   */
  async rebaseWarranties(assetId: string, purchase: AssetPurchase | null): Promise<number> {
    const repo = this.repo(AssetWarranty);
    const rows = await repo.find({ where: { assetId } });
    let changed = 0;
    for (const w of rows) {
      const next = rebaseWarranty(w, purchase);
      if (!next) continue;
      await repo.update({ id: w.id }, next);
      changed++;
    }
    return changed;
  }

  // --- Doklady ---

  documents(assetId: string): Promise<AssetDocument[]> {
    return this.repo(AssetDocument).find({
      where: { assetId, hidden: false },
      order: { createdAt: 'DESC' },
    });
  }

  async uploadDocument(
    assetId: string,
    docType: AssetDocumentType,
    file: { buffer: Buffer; mimetype: string; originalname?: string },
    userId?: string,
  ): Promise<AssetDocument> {
    await this.assertAsset(assetId);
    const key = `asset-documents/${this.context.tenantId}/${assetId}/${randomUUID()}`;
    await this.storage.put(key, file.buffer, file.mimetype);
    const repo = this.repo(AssetDocument);
    const saved = await repo.save(
      repo.create({
        tenantId: this.context.tenantId,
        assetId,
        docType,
        fileName: file.originalname ? decodeFileName(file.originalname) : null,
        fileKey: key,
        mime: file.mimetype,
        sizeBytes: file.buffer.length,
        sha256: createHash('sha256').update(file.buffer).digest('hex'),
        uploadedBy: userId ?? null,
      }),
    );
    await this.audit.record({
      action: 'asset.document.upload',
      targetType: 'asset',
      targetId: assetId,
      after: { documentId: saved.id, docType },
    });
    // Interní klíč souboru se klientovi nevrací.
    return Object.assign(saved, { fileKey: undefined }) as AssetDocument;
  }

  /**
   * Soubor dokladu. Záruční list smí otevřít každý, kdo vidí položku (reklamace
   * v terénu); faktura a ostatní doklady jen s `asset.purchase.view`.
   */
  async documentFile(
    documentId: string,
    user: RequestUser,
  ): Promise<{ buffer: Buffer; mime: string; fileName: string | null }> {
    const doc = await this.repo(AssetDocument)
      .createQueryBuilder('d')
      .addSelect('d.fileKey')
      .where('d.id = :id AND d.hidden = false', { id: documentId })
      .getOne();
    if (!doc) throw new NotFoundException('Doklad neexistuje');
    if (doc.docType !== 'warranty') await this.authz.assert(user, 'asset.purchase.view');
    return { buffer: await this.storage.get(doc.fileKey), mime: doc.mime, fileName: doc.fileName };
  }

  async hideDocument(documentId: string): Promise<void> {
    const repo = this.repo(AssetDocument);
    const doc = await repo.findOne({ where: { id: documentId } });
    if (!doc) throw new NotFoundException('Doklad neexistuje');
    await repo.update({ id: doc.id }, { hidden: true });
    await this.repo(AssetWarranty).update({ documentId: doc.id }, { documentId: null });
    await this.audit.record({
      action: 'asset.document.hide',
      targetType: 'asset',
      targetId: doc.assetId,
      before: { documentId: doc.id, docType: doc.docType },
    });
  }

  // --- Záruky ---

  async warranties(assetId: string): Promise<WarrantyView[]> {
    await this.assertAsset(assetId);
    const rows = await this.repo(AssetWarranty).find({
      where: { assetId },
      order: { endsOn: 'ASC' },
    });
    return this.withStatus(rows);
  }

  /** Záruky, které skončí do `days` dní (ještě platné) – pro „Vyžaduje pozornost". */
  async expiring(days = WARRANTY_EXPIRING_DAYS): Promise<ExpiringWarranty[]> {
    const today = todayInPrague();
    const rows = await this.repo(AssetWarranty)
      .createQueryBuilder('w')
      .innerJoin(Asset, 'a', 'a.id = w.asset_id')
      .addSelect('a.name', 'asset_name')
      .where('w.ends_on >= :today AND w.ends_on <= :until', {
        today,
        until: addDays(today, Math.max(0, days)),
      })
      .andWhere('a.status NOT IN (:...inactive)', { inactive: INACTIVE_STATUSES })
      .orderBy('w.ends_on', 'ASC')
      .getRawAndEntities();
    const views = await this.withStatus(rows.entities);
    return views.map((w, i) => ({ ...w, assetName: String(rows.raw[i]?.asset_name ?? '') }));
  }

  async createWarranty(assetId: string, dto: WarrantyDto): Promise<WarrantyView> {
    await this.assertAsset(assetId);
    const repo = this.repo(AssetWarranty);
    const row = repo.create({ tenantId: this.context.tenantId, assetId });
    await this.applyWarranty(row, dto, true);
    const saved = await repo.save(row);
    await this.audit.record({
      action: 'asset.warranty.create',
      targetType: 'asset',
      targetId: assetId,
      after: saved as unknown as Record<string, unknown>,
    });
    return (await this.withStatus([saved]))[0];
  }

  async updateWarranty(warrantyId: string, dto: WarrantyDto): Promise<WarrantyView> {
    const repo = this.repo(AssetWarranty);
    const row = await repo.findOne({ where: { id: warrantyId } });
    if (!row) throw new NotFoundException('Záruka neexistuje');
    const before = { ...row };
    await this.applyWarranty(row, dto, false);
    const saved = await repo.save(row);
    await this.audit.record({
      action: 'asset.warranty.update',
      targetType: 'asset',
      targetId: row.assetId,
      before: before as unknown as Record<string, unknown>,
      after: saved as unknown as Record<string, unknown>,
    });
    return (await this.withStatus([saved]))[0];
  }

  async deleteWarranty(warrantyId: string): Promise<void> {
    const repo = this.repo(AssetWarranty);
    const row = await repo.findOne({ where: { id: warrantyId } });
    if (!row) throw new NotFoundException('Záruka neexistuje');
    await repo.delete({ id: row.id });
    await this.audit.record({
      action: 'asset.warranty.delete',
      targetType: 'asset',
      targetId: row.assetId,
      before: row as unknown as Record<string, unknown>,
    });
  }

  private async applyWarranty(row: AssetWarranty, dto: WarrantyDto, isNew: boolean) {
    row.title = dto.title.trim() || 'Záruka';
    for (const d of [dto.startsOn, dto.endsOn]) {
      if (d && !isIsoDate(d)) throw new BadRequestException(`Neplatné datum ${d}`);
    }
    const purchase = await this.repo(AssetPurchase).findOne({ where: { assetId: row.assetId } });
    const basis: WarrantyStartBasis =
      dto.startBasis ??
      (dto.startsOn !== undefined
        ? 'custom'
        : isNew
          ? defaultStartBasis(purchase)
          : (row.startBasis ?? 'custom'));
    const startsOn =
      basis === 'custom'
        ? dto.startsOn !== undefined
          ? dto.startsOn || null
          : row.startsOn
        : warrantyStartFor(basis, purchase);
    const months = dto.months !== undefined ? dto.months : row.months;
    const explicitEnd = dto.endsOn !== undefined ? dto.endsOn : null;
    const endsOn = warrantyEnd({ startsOn, months, endsOn: explicitEnd || null });
    if (!endsOn) {
      throw new BadRequestException(
        basis === 'purchase'
          ? 'Chybí datum pořízení – vyplň ho v Pořízení, nebo zadej začátek či konec záruky ručně'
          : basis === 'in_service'
            ? 'Chybí datum uvedení do provozu – vyplň ho v Pořízení, nebo zadej začátek či konec záruky ručně'
            : 'Zadej konec záruky, nebo začátek a délku v měsících',
      );
    }
    if (startsOn && endsOn < startsOn)
      throw new BadRequestException('Konec záruky je před jejím začátkem');
    row.startBasis = basis;
    row.startsOn = startsOn;
    row.months = explicitEnd ? null : months;
    row.endsOn = endsOn;
    if (dto.provider !== undefined) row.provider = dto.provider?.trim() || null;
    if (dto.note !== undefined) row.note = dto.note?.trim() || null;
    if (dto.documentId !== undefined) {
      if (dto.documentId) {
        const doc = await this.repo(AssetDocument).findOne({
          where: { id: dto.documentId, assetId: row.assetId, hidden: false },
        });
        if (!doc) throw new BadRequestException('Doklad nepatří k této položce');
      }
      row.documentId = dto.documentId || null;
    }
  }

  private async withStatus(rows: AssetWarranty[]): Promise<WarrantyView[]> {
    const today = todayInPrague();
    const docIds = [...new Set(rows.map((r) => r.documentId).filter((x): x is string => !!x))];
    const docs = docIds.length
      ? await this.repo(AssetDocument)
          .createQueryBuilder('d')
          .where('d.id IN (:...ids) AND d.hidden = false', { ids: docIds })
          .getMany()
      : [];
    const byId = new Map(docs.map((d) => [d.id, d]));
    return rows.map((r) => {
      const doc = r.documentId ? byId.get(r.documentId) : undefined;
      return {
        ...r,
        status: warrantyStatus(r.endsOn, today),
        document: doc ? { id: doc.id, fileName: doc.fileName, mime: doc.mime } : null,
      };
    });
  }
}
