import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/** Sledovaná firma v síti (view pro nájemce). */
export interface FollowedTenant {
  tenantId: string;
  name: string;
  slug: string | null;
  listingCount: number;
  followedAt: string;
}

/** Položka feedu – publikovaný inzerát sledované firmy. */
export interface FeedItem {
  listingId: string;
  slug: string;
  title: string;
  description: string | null;
  currency: string;
  pricePerDay: string;
  depositAmount: string;
  pickup: string | null;
  assetName: string;
  photoCount: number;
  tenantId: string;
  tenantName: string;
  tenantSlug: string | null;
  publishedAt: string | null;
}

/**
 * EPIC-21 síť/discovery. Nájemce běží MIMO tenant kontext (renter guard nenastaví
 * request.user) → veškeré čtení/zápis jde přes SECURITY DEFINER funkce nad
 * veřejnou projekcí; nikdy ne přes tenant-scoped repozitáře.
 */
@Injectable()
export class NetworkService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Sledovat firmu. Vrací false, pokud firma není opt-in v síti. */
  async follow(userId: string, tenantId: string): Promise<boolean> {
    const rows = (await this.dataSource.query(`SELECT network_follow($1, $2) AS ok`, [
      userId,
      tenantId,
    ])) as { ok: boolean }[];
    return rows[0]?.ok === true;
  }

  async unfollow(userId: string, tenantId: string): Promise<void> {
    await this.dataSource.query(`SELECT network_unfollow($1, $2)`, [userId, tenantId]);
  }

  /** Feed publikovaných inzerátů sledovaných opt-in firem (stránkovaný). */
  async feed(userId: string, limit = 30, offset = 0): Promise<FeedItem[]> {
    const rows = (await this.dataSource.query(`SELECT * FROM network_feed($1, $2, $3)`, [
      userId,
      Math.min(Math.max(limit, 1), 60),
      Math.max(offset, 0),
    ])) as Record<string, unknown>[];
    return rows.map((r) => ({
      listingId: String(r.listing_id),
      slug: String(r.slug),
      title: String(r.title),
      description: (r.description as string | null) ?? null,
      currency: String(r.currency),
      pricePerDay: String(r.price_per_day),
      depositAmount: String(r.deposit_amount),
      pickup: (r.pickup as string | null) ?? null,
      assetName: String(r.asset_name),
      photoCount: Number(r.photo_count ?? 0),
      tenantId: String(r.tenant_id),
      tenantName: String(r.tenant_name),
      tenantSlug: (r.tenant_slug as string | null) ?? null,
      publishedAt:
        r.published_at instanceof Date
          ? r.published_at.toISOString()
          : r.published_at
            ? String(r.published_at)
            : null,
    }));
  }

  async followed(userId: string): Promise<FollowedTenant[]> {
    const rows = (await this.dataSource.query(`SELECT * FROM network_followed_tenants($1)`, [
      userId,
    ])) as Record<string, unknown>[];
    return rows.map((r) => ({
      tenantId: String(r.tenant_id),
      name: String(r.name),
      slug: (r.slug as string | null) ?? null,
      listingCount: Number(r.listing_count ?? 0),
      followedAt: r.followed_at instanceof Date ? r.followed_at.toISOString() : String(r.followed_at),
    }));
  }
}
