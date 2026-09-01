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
