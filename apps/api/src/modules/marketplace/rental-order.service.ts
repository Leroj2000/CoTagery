import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantContextService } from '../../core/tenancy/tenant-context.service';
import { RentalListingService } from './rental-listing.service';
import { RenterAuthService } from './renter-auth.service';
import { computeQuote, type Quote } from './order-pricing';
import type { RequestRenter } from './renter-jwt.guard';

/** Chybové kódy z PostgreSQL, které mapujeme na HTTP odpovědi. */
const PG_EXCLUSION_VIOLATION = '23P01';

/** timestamptz z pg (Date | string) → stabilní ISO string pro API/klienta. */
function iso(v: unknown): string {
  return v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString();
}

export interface AvailabilityPeriod {
  startsAt: string;
  endsAt: string;
}

export interface RenterOrderView {
  orderId: string;
  status: string;
  startsAt: string;
  endsAt: string;
  days: number;
  rentAmount: string;
  depositAmount: string;
  total: string;
  currency: string;
  listingTitle: string;
  listingSlug: string;
  assetName: string;
  tenantName: string;
  tenantSlug: string;
  pickup: string | null;
  createdAt: string;
}

export interface OwnerOrderView {
  id: string;
  status: string;
  startsAt: Date;
  endsAt: Date;
  days: number;
  rentAmount: string;
  depositAmount: string;
  total: string;
  currency: string;
  listingTitle: string;
  assetName: string;
  renterName: string;
  renterEmail: string;
  createdAt: Date;
}

@Injectable()
export class RentalOrderService {
  constructor(
    private readonly context: TenantContextService,
    private readonly dataSource: DataSource,
    private readonly listings: RentalListingService,
    private readonly renterAuth: RenterAuthService,
  ) {}

  /** Nezávazná nabídka (cena) pro dané období – pro UI před objednáním. */
  async quote(
    tenantSlug: string,
    listingSlug: string,
    startsAt: string,
    endsAt: string,
  ): Promise<Quote> {
    const listing = await this.listings.publicListing(tenantSlug, listingSlug);
    if (!listing) throw new NotFoundException('Inzerát není dostupný');
    return this.priceOrThrow(listing, startsAt, endsAt);
  }

  /** Obsazené termíny věci daného inzerátu (pro kalendář, veřejné). */
  async availability(listingId: string): Promise<AvailabilityPeriod[]> {
    const rows = await this.dataSource.query(
      `SELECT * FROM public_listing_availability($1)`,
      [listingId],
    );
    return (rows as { starts_at: unknown; ends_at: unknown }[]).map((r) => ({
      startsAt: iso(r.starts_at),
      endsAt: iso(r.ends_at),
    }));
  }

  /** Nájemce vytvoří objednávku (cross-tenant, přes SECURITY DEFINER). */
  async createOrder(
    renter: RequestRenter,
    input: { tenantSlug: string; listingSlug: string; startsAt: string; endsAt: string; note?: string },
  ): Promise<{ orderId: string; quote: Quote }> {
    const listing = await this.listings.publicListing(input.tenantSlug, input.listingSlug);
    if (!listing) throw new NotFoundException('Inzerát není dostupný');
    const quote = this.priceOrThrow(listing, input.startsAt, input.endsAt);
    const profileId = await this.renterAuth.profileIdForEmail(renter.email);

    try {
      const rows = await this.dataSource.query(
        `SELECT create_rental_order($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) AS id`,
        [
          listing.listingId,
          renter.userId,
          profileId,
          input.startsAt,
          input.endsAt,
          quote.days,
          quote.rentAmount,
          quote.depositAmount,
          quote.total,
          input.note ?? null,
        ],
      );
      return { orderId: (rows as { id: string }[])[0].id, quote };
    } catch (err) {
      const code = (err as { code?: string }).code;
      const message = (err as { message?: string }).message ?? '';
      if (code === PG_EXCLUSION_VIOLATION) {
        throw new ConflictException('Tento termín je již obsazený, vyber jiný.');
      }
      if (message.includes('listing_not_available')) {
        throw new NotFoundException('Inzerát již není dostupný');
      }
      throw err;
    }
  }

  /** Renter portál „Moje výpůjčky" (self-scoped napříč firmami). */
  async myOrders(userId: string): Promise<RenterOrderView[]> {
    const rows = await this.dataSource.query(`SELECT * FROM my_rental_orders($1)`, [userId]);
    return (rows as Record<string, unknown>[]).map((r) => ({
      orderId: String(r.order_id),
      status: String(r.status),
      startsAt: iso(r.starts_at),
      endsAt: iso(r.ends_at),
      days: Number(r.days),
      rentAmount: String(r.rent_amount),
      depositAmount: String(r.deposit_amount),
      total: String(r.total),
      currency: String(r.currency),
      listingTitle: String(r.listing_title),
      listingSlug: String(r.listing_slug),
      assetName: String(r.asset_name),
      tenantName: String(r.tenant_name),
      tenantSlug: String(r.tenant_slug),
      pickup: (r.pickup as string | null) ?? null,
      createdAt: iso(r.created_at),
    }));
  }

  /** Majitel: příchozí objednávky jeho firmy (tenant-scoped, RLS). */
  async listForOwner(): Promise<OwnerOrderView[]> {
    const rows = await this.context.manager.query(
      `SELECT o.id, o.status, o.starts_at, o.ends_at, o.days,
              o.rent_amount, o.deposit_amount, o.total, o.currency,
              l.title AS listing_title, a.name AS asset_name,
              u.name AS renter_name, u.email AS renter_email, o.created_at
         FROM rental_order o
         JOIN rental_listing l ON l.id = o.listing_id
         JOIN assets a ON a.id = o.asset_id
         JOIN users u ON u.id = o.renter_user_id
        ORDER BY o.created_at DESC`,
    );
    return (rows as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      status: String(r.status),
      startsAt: r.starts_at as Date,
      endsAt: r.ends_at as Date,
      days: Number(r.days),
      rentAmount: String(r.rent_amount),
      depositAmount: String(r.deposit_amount),
      total: String(r.total),
      currency: String(r.currency),
      listingTitle: String(r.listing_title),
      assetName: String(r.asset_name),
      renterName: String(r.renter_name),
      renterEmail: String(r.renter_email),
      createdAt: r.created_at as Date,
    }));
  }

  private priceOrThrow(
    listing: { pricePerDay: string; depositAmount: string; currency: string; minDays: number; maxDays: number | null },
    startsAt: string,
    endsAt: string,
  ): Quote {
    try {
      return computeQuote(listing, new Date(startsAt), new Date(endsAt));
    } catch (err) {
      const code = (err as Error).message;
      const map: Record<string, string> = {
        invalid_period: 'Neplatné období rezervace.',
        below_min_days: 'Rezervace je kratší než minimální doba půjčení.',
        above_max_days: 'Rezervace přesahuje maximální dobu půjčení.',
      };
      throw new BadRequestException(map[code] ?? 'Neplatné období rezervace.');
    }
  }
}
