import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { TenantContextService } from '../../core/tenancy/tenant-context.service';
import { User } from '../../core/auth/entities/user.entity';
import { Person } from '../../core/domain/entities/person.entity';
import { QrService } from '../../core/domain/carriers/qr.service';
import { AssetService } from '../asset/asset.service';
import { RentalListingService } from './rental-listing.service';
import { RenterAuthService } from './renter-auth.service';
import { computeQuote, type Quote } from './order-pricing';
import { RentalOrder } from './entities/rental-order.entity';
import { canTransition, OWNER_ACTIONS, type OwnerAction } from './order-status.logic';
import { PAYMENT_ADAPTER, type PaymentAdapter, type PaymentInstruction } from './payment/payment.port';
import type { RequestRenter } from './renter-jwt.guard';

export interface RenterPaymentView extends PaymentInstruction {
  orderId: string;
  status: string;
  listingTitle: string;
  tenantName: string;
}

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
  renterNote: string | null;
  paymentVs: string;
  createdAt: Date;
}

@Injectable()
export class RentalOrderService {
  constructor(
    private readonly context: TenantContextService,
    private readonly dataSource: DataSource,
    private readonly listings: RentalListingService,
    private readonly renterAuth: RenterAuthService,
    private readonly assets: AssetService,
    private readonly qr: QrService,
    @Inject(PAYMENT_ADAPTER) private readonly payment: PaymentAdapter,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  /** Pokyny k platbě nájemci (SPAYD/QR + bankovní údaje majitele). Self-scoped. */
  async renterPayment(orderId: string, userId: string): Promise<RenterPaymentView> {
    const instruction = await this.buildPayment(orderId, userId);
    return instruction;
  }

  /** QR obrázek (PNG) platebního SPAYD řetězce objednávky. */
  async renterPaymentQr(orderId: string, userId: string): Promise<Buffer> {
    const instruction = await this.buildPayment(orderId, userId);
    return this.qr.png(instruction.spayd);
  }

  private async buildPayment(orderId: string, userId: string): Promise<RenterPaymentView> {
    const rows = await this.dataSource.query(`SELECT * FROM renter_order_payment($1, $2)`, [
      orderId,
      userId,
    ]);
    const r = (rows as Record<string, unknown>[])[0];
    if (!r) throw new NotFoundException('Objednávka neexistuje');
    const bank = (r.bank as { iban?: string; accountName?: string } | null) ?? {};
    const vs = String(r.payment_vs);
    const instruction = this.payment.createInstruction({
      iban: bank.iban ?? '',
      accountName: bank.accountName ?? null,
      amount: String(r.total),
      currency: String(r.currency),
      variableSymbol: vs,
      message: `Pujcovna ${String(r.listing_title)} #${vs}`,
    });
    return {
      ...instruction,
      orderId: String(r.order_id),
      status: String(r.status),
      listingTitle: String(r.listing_title),
      tenantName: String(r.tenant_name),
    };
  }

  private orderRepo(): Repository<RentalOrder> {
    return this.context.manager.getRepository(RentalOrder);
  }

  private personRepo(): Repository<Person> {
    return this.context.manager.getRepository(Person);
  }

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

  /**
   * Nájemce nahlásí poškození/poruchu na půjčené věci (SECURITY DEFINER zápis do
   * asset_issues). Gate „mám objednávku na tuto věc" (picked_up/returned/completed).
   */
  async createRenterIssue(
    userId: string,
    orderId: string,
    kind: string,
    description: string,
  ): Promise<{ issueId: string }> {
    try {
      const rows = await this.dataSource.query(`SELECT create_renter_issue($1,$2,$3,$4) AS id`, [
        orderId,
        userId,
        kind,
        description,
      ]);
      return { issueId: (rows as { id: string }[])[0].id };
    } catch (err) {
      const message = (err as { message?: string }).message ?? '';
      if (message.includes('order_not_found')) {
        throw new NotFoundException('Objednávka neexistuje');
      }
      if (message.includes('issue_not_allowed')) {
        throw new BadRequestException('Hlásit poškození lze až po vyzvednutí položky');
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
              u.name AS renter_name, u.email AS renter_email,
              o.renter_note, o.payment_vs, o.created_at
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
      renterNote: (r.renter_note as string | null) ?? null,
      paymentVs: String(r.payment_vs),
      createdAt: r.created_at as Date,
    }));
  }

  /**
   * Majitel posune objednávku ve stavovém automatu (F3). Vedlejší efekty:
   * pickup → `loan` pohyb věci na Person nájemce; return → `return` pohyb +
   * vypořádání kauce. Custody běží pod tenant kontextem majitele (RLS).
   */
  async ownerTransition(
    orderId: string,
    action: OwnerAction,
    opts?: { depositReturned?: string; note?: string },
  ): Promise<RentalOrder> {
    const order = await this.orderRepo().findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Objednávka neexistuje');
    const target = OWNER_ACTIONS[action];
    if (!canTransition(order.status, target)) {
      throw new BadRequestException(`Přechod z '${order.status}' na '${target}' není povolený`);
    }
    const now = new Date();

    if (action === 'confirm_payment') {
      order.status = 'paid';
      order.paidAt = now;
      order.paymentMethod = order.paymentMethod ?? 'qr_transfer';
    } else if (action === 'pickup') {
      const person = await this.ensureRenterPerson(order);
      await this.moveAsset(order.assetId, {
        type: 'loan',
        toType: 'person',
        toId: person.id,
        note: `Půjčovna – objednávka #${order.paymentVs}`,
      });
      order.status = 'picked_up';
      order.pickedUpAt = now;
      order.renterPersonId = person.id;
    } else if (action === 'return') {
      // Vrácení do domovské lokace (bez fotky – marketplace tok; fotku lze doplnit
      // běžným asset flow). Kauce se vypořádá: default = vrátit celou.
      await this.moveAsset(order.assetId, { type: 'return', toType: 'location', toId: null }, true);
      order.status = 'returned';
      order.returnedAt = now;
      order.settledAt = now;
      order.depositReturned = opts?.depositReturned ?? order.depositAmount;
    } else if (action === 'complete') {
      order.status = 'completed';
      order.completedAt = now;
    } else if (action === 'cancel') {
      order.status = 'cancelled';
      order.cancelledAt = now;
    }
    return this.orderRepo().save(order);
  }

  /** Provede asset pohyb v tenant kontextu majitele; mapuje custody chybu na 400. */
  private async moveAsset(
    assetId: string,
    mv: { type: 'loan' | 'return'; toType: 'person' | 'location'; toId: string | null; note?: string },
    skipReturnPhoto = false,
  ): Promise<void> {
    try {
      await this.assets.performMovement(
        assetId,
        { type: mv.type, toType: mv.toType, toId: mv.toId ?? undefined, note: mv.note },
        { skipReturnPhotoCheck: skipReturnPhoto },
      );
    } catch (err) {
      const msg = (err as Error).message ?? 'Pohyb položky selhal';
      throw new BadRequestException(`Položku nelze ${mv.type === 'loan' ? 'předat' : 'vrátit'}: ${msg}`);
    }
  }

  /** Najde/založí Person nájemce v tenantu majitele (držitel při vyzvednutí). */
  private async ensureRenterPerson(order: RentalOrder): Promise<Person> {
    const existing = order.renterPersonId
      ? await this.personRepo().findOne({ where: { id: order.renterPersonId } })
      : await this.personRepo().findOne({ where: { userId: order.renterUserId } });
    if (existing) return existing;
    const user = await this.users.findOne({ where: { id: order.renterUserId } });
    return this.personRepo().save(
      this.personRepo().create({
        tenantId: this.context.tenantId,
        name: user?.name ?? 'Nájemce',
        email: user?.email ?? null,
        phone: null,
        company: null,
        userId: order.renterUserId,
      }),
    );
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
