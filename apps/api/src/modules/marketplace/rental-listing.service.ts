import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { TenantContextService } from '../../core/tenancy/tenant-context.service';
import { STORAGE, type StoragePort } from '../../core/storage/storage.port';
import { Asset } from '../asset/entities/asset.entity';
import { RentalListing } from './entities/rental-listing.entity';
import type { CreateListingDto, UpdateListingDto } from './dto/listing.dto';

/** Diakritiku pryč, non-alnum → '-', trim. */
function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'inzerat';
}

export interface PublicCatalogItem {
  listingId: string;
  slug: string;
  title: string;
  description: string | null;
  currency: string;
  pricePerDay: string;
  pricePerHour: string | null;
  pricePerWeek: string | null;
  depositAmount: string;
  minDays: number;
  maxDays: number | null;
  pickup: string | null;
  assetName: string;
  photoCount: number;
}

@Injectable()
export class RentalListingService {
  constructor(
    private readonly context: TenantContextService,
    private readonly dataSource: DataSource,
    @Inject(STORAGE) private readonly storage: StoragePort,
  ) {}

  private repo(): Repository<RentalListing> {
    return this.context.manager.getRepository(RentalListing);
  }

  // --- Admin (tenant-scoped) ---
  list(): Promise<RentalListing[]> {
    return this.repo().find({ order: { createdAt: 'DESC' } });
  }

  async get(id: string): Promise<RentalListing> {
    const listing = await this.repo().findOne({ where: { id } });
    if (!listing) throw new NotFoundException('Inzerát neexistuje');
    return listing;
  }

  private async assertAsset(assetId: string): Promise<Asset> {
    const asset = await this.context.manager.getRepository(Asset).findOne({ where: { id: assetId } });
    if (!asset) throw new NotFoundException('Věc neexistuje');
    return asset;
  }

  /** Unikátní slug v rámci tenanta (append -2, -3 … při kolizi). */
  private async uniqueSlug(base: string): Promise<string> {
    const root = slugify(base);
    const existing = await this.repo()
      .createQueryBuilder('l')
      .select('l.slug', 'slug')
      .where('l.slug = :root OR l.slug LIKE :like', { root, like: `${root}-%` })
      .getRawMany<{ slug: string }>();
    const taken = new Set(existing.map((e) => e.slug));
    if (!taken.has(root)) return root;
    for (let i = 2; i < 1000; i += 1) {
      const cand = `${root}-${i}`;
      if (!taken.has(cand)) return cand;
    }
    return `${root}-${Date.now()}`;
  }

  async create(dto: CreateListingDto): Promise<RentalListing> {
    const asset = await this.assertAsset(dto.assetId);
    const title = dto.title?.trim() || asset.name;
    const slug = await this.uniqueSlug(title);
    const listing = this.repo().create({
      tenantId: this.context.tenantId,
      assetId: asset.id,
      status: 'draft',
      title,
      description: dto.description ?? null,
      terms: dto.terms ?? null,
      pickupLocationId: dto.pickupLocationId ?? asset.homeLocationId ?? null,
      currency: dto.currency ?? 'CZK',
      pricePerDay: dto.pricePerDay ?? '0',
      pricePerHour: dto.pricePerHour ?? null,
      pricePerWeek: dto.pricePerWeek ?? null,
      depositAmount: dto.depositAmount ?? '0',
      minDays: dto.minDays ?? 1,
      maxDays: dto.maxDays ?? null,
      slug,
    });
    return this.repo().save(listing);
  }

  async update(id: string, dto: UpdateListingDto): Promise<RentalListing> {
    const listing = await this.get(id);
    if (dto.title !== undefined) listing.title = dto.title.trim() || listing.title;
    if (dto.description !== undefined) listing.description = dto.description || null;
    if (dto.terms !== undefined) listing.terms = dto.terms || null;
    if (dto.pickupLocationId !== undefined) listing.pickupLocationId = dto.pickupLocationId || null;
    if (dto.currency !== undefined) listing.currency = dto.currency || 'CZK';
    if (dto.pricePerDay !== undefined) listing.pricePerDay = dto.pricePerDay;
    if (dto.pricePerHour !== undefined) listing.pricePerHour = dto.pricePerHour || null;
    if (dto.pricePerWeek !== undefined) listing.pricePerWeek = dto.pricePerWeek || null;
    if (dto.depositAmount !== undefined) listing.depositAmount = dto.depositAmount;
    if (dto.minDays !== undefined) listing.minDays = dto.minDays;
    if (dto.maxDays !== undefined) listing.maxDays = dto.maxDays;
    return this.repo().save(listing);
  }

  async setPublished(id: string, published: boolean): Promise<RentalListing> {
    const listing = await this.get(id);
    listing.status = published ? 'published' : 'draft';
    if (published && !listing.publishedAt) listing.publishedAt = new Date();
    return this.repo().save(listing);
  }

  async remove(id: string): Promise<void> {
    const listing = await this.get(id);
    await this.repo().remove(listing);
  }

  // --- Veřejné čtení (mimo tenant kontext, přes SECURITY DEFINER) ---
  async publicCatalog(tenantSlug: string): Promise<PublicCatalogItem[]> {
    const rows = await this.dataSource.query(
      `SELECT * FROM public_rental_catalog($1)`,
      [tenantSlug],
    );
    return (rows as Record<string, unknown>[]).map(mapCatalogRow);
  }

  async publicListing(
    tenantSlug: string,
    listingSlug: string,
  ): Promise<(PublicCatalogItem & { terms: string | null; tenantName: string }) | null> {
    const rows = await this.dataSource.query(
      `SELECT * FROM public_rental_listing($1, $2)`,
      [tenantSlug, listingSlug],
    );
    const r = (rows as Record<string, unknown>[])[0];
    if (!r) return null;
    return {
      ...mapCatalogRow(r),
      terms: (r.terms as string | null) ?? null,
      tenantName: String(r.tenant_name ?? ''),
    };
  }

  async publicPhoto(listingId: string, idx: number): Promise<{ buffer: Buffer; mime: string }> {
    const rows = await this.dataSource.query(
      `SELECT * FROM public_rental_photo($1, $2)`,
      [listingId, idx],
    );
    const r = (rows as { file_key: string; mime: string }[])[0];
    if (!r) throw new NotFoundException('Fotka neexistuje');
    return { buffer: await this.storage.get(r.file_key), mime: r.mime };
  }
}

function mapCatalogRow(r: Record<string, unknown>): PublicCatalogItem {
  return {
    listingId: String(r.listing_id),
    slug: String(r.slug),
    title: String(r.title),
    description: (r.description as string | null) ?? null,
    currency: String(r.currency),
    pricePerDay: String(r.price_per_day),
    pricePerHour: r.price_per_hour != null ? String(r.price_per_hour) : null,
    pricePerWeek: r.price_per_week != null ? String(r.price_per_week) : null,
    depositAmount: String(r.deposit_amount),
    minDays: Number(r.min_days),
    maxDays: r.max_days != null ? Number(r.max_days) : null,
    pickup: (r.pickup as string | null) ?? null,
    assetName: String(r.asset_name),
    photoCount: Number(r.photo_count),
  };
}
