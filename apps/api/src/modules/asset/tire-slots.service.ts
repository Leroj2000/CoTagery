import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  TIRE_SLOT_SEASON_LABELS,
  type AssetTireBookingView,
  type TireBookingStatus,
  type TireBookingView,
  type TireSlotSeason,
  type TireSlotView,
} from '@tagery/shared';
import type { RequestUser } from '../../core/auth/jwt-auth.guard';
import { AuditService } from '../../core/rbac/audit.service';
import { AuthzService } from '../../core/rbac/authz.service';
import { TenantContextService } from '../../core/tenancy/tenant-context.service';
import { AssetService } from './asset.service';
import type { Asset } from './entities/asset.entity';
import { TiresService } from './tires.service';
import { AssetNotificationsService, type TireCancelNotice } from './asset-notifications.service';
import {
  CUTOFF_MS,
  bookingDenial,
  bookingPerson,
  cancelDenial,
  cancelRecipient,
  generateSlotTimes,
  pickSeasonSet,
  slotDenial,
} from './tire-slots.logic';

export const TIRESLOT_MANAGE = 'asset.tireslot.manage';

export interface CreateTireSlotsInput {
  startsAt: string;
  endsAt: string;
  durationMin: number;
  capacity?: number;
  location?: string;
  note?: string;
  season?: TireSlotSeason;
}

interface SlotRow {
  id: string;
  starts_at: Date;
  ends_at: Date;
  location: string | null;
  note: string | null;
  capacity: number;
  season: TireSlotSeason | null;
  cancelled_at: Date | null;
  booked: number;
}

interface BookingRow {
  id: string;
  slot_id: string;
  asset_id: string;
  asset_name: string;
  plate: string | null;
  person_id: string | null;
  person_name: string | null;
  status: TireBookingStatus;
  starts_at: Date;
  ends_at: Date;
  location: string | null;
  season: TireSlotSeason | null;
}

const BOOKING_SELECT = `
  SELECT b.id, b.slot_id, b.asset_id, a.name AS asset_name, a.registration_plate AS plate,
         b.person_id, p.name AS person_name, b.status, s.starts_at, s.ends_at, s.location, s.season
    FROM tire_change_bookings b
    JOIN tire_change_slots s ON s.id = b.slot_id AND s.tenant_id = b.tenant_id
    JOIN assets a ON a.id = b.asset_id AND a.tenant_id = b.tenant_id
    LEFT JOIN people p ON p.id = b.person_id`;

const SLOT_SELECT = `
  SELECT s.id, s.starts_at, s.ends_at, s.location, s.note, s.capacity, s.season, s.cancelled_at,
         (SELECT count(*)::int FROM tire_change_bookings b
           WHERE b.slot_id = s.id AND b.tenant_id = s.tenant_id AND b.status IN ('booked','done')) AS booked
    FROM tire_change_slots s`;

const fmt = new Intl.DateTimeFormat('cs-CZ', {
  timeZone: 'Europe/Prague',
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

/**
 * Termíny přezutí: vypsání slotů (správce), rezervace vozidla držitelem nebo
 * odpovědnou osobou, přesun/zrušení do 24 h před termínem a „Hotovo“ (přezutí na
 * sadu sezóny termínu + servisní záznam). Vše v tenant transakci (RLS); kapacitu
 * hlídá zámek řádku termínu, jednu aktivní rezervaci na vozidlo partial unique.
 * Nic neposílá e-mailem ani jinými notifikacemi.
 */
@Injectable()
export class TireSlotsService {
  constructor(
    private readonly context: TenantContextService,
    private readonly assets: AssetService,
    private readonly tires: TiresService,
    private readonly authz: AuthzService,
    private readonly audit: AuditService,
    private readonly notifier: AssetNotificationsService,
  ) {}

  private get tenantId(): string {
    const id = this.context.tenantId;
    if (!id) throw new ForbiddenException('Chybí kontext firmy');
    return id;
  }

  private q<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.context.manager.query(sql, params);
  }

  async isManager(user: RequestUser): Promise<boolean> {
    return (await this.authz.can(user, TIRESLOT_MANAGE)).allowed;
  }

  /** Osoba spojená s účtem (stejné pravidlo jako osobní workflow); null = nejednoznačné. */
  private async personId(userId: string): Promise<string | null> {
    const rows = await this.q<{ id: string }>(
      `SELECT p.id FROM people p JOIN users u ON u.id = $1
        WHERE p.user_id = $1 OR (p.user_id IS NULL AND lower(p.email) = lower(u.email))`,
      [userId],
    );
    return rows.length === 1 ? rows[0].id : null;
  }

  private async equipmentKind(asset: Asset): Promise<string | null> {
    if (!asset.categoryId) return null;
    const rows = await this.q<{ equipment_kind: string }>(
      `SELECT equipment_kind FROM asset_categories WHERE id = $1`,
      [asset.categoryId],
    );
    return rows[0]?.equipment_kind ?? null;
  }

  private async visible(assetId: string): Promise<boolean> {
    try {
      await this.assets.get(assetId);
      return true;
    } catch (e) {
      if (e instanceof NotFoundException) return false;
      throw e;
    }
  }

  private toBooking(r: BookingRow, changeable: boolean): TireBookingView {
    return {
      id: r.id,
      slotId: r.slot_id,
      assetId: r.asset_id,
      assetName: r.asset_name,
      plate: r.plate,
      personId: r.person_id,
      personName: r.person_name,
      status: r.status,
      startsAt: new Date(r.starts_at).toISOString(),
      endsAt: new Date(r.ends_at).toISOString(),
      location: r.location,
      season: r.season,
      changeable,
    };
  }

  private toSlot(
    r: SlotRow,
    now: Date,
    manager: boolean,
    bookings: TireBookingView[],
  ): TireSlotView {
    const startsAt = new Date(r.starts_at);
    return {
      id: r.id,
      startsAt: startsAt.toISOString(),
      endsAt: new Date(r.ends_at).toISOString(),
      location: r.location,
      note: r.note,
      capacity: r.capacity,
      season: r.season,
      booked: Number(r.booked),
      bookable:
        slotDenial(
          { startsAt, cancelledAt: r.cancelled_at, capacity: r.capacity, booked: Number(r.booked) },
          now,
          manager,
        ) === null,
      bookings,
    };
  }

  private changeable(r: BookingRow, now: Date, manager: boolean): boolean {
    return (
      cancelDenial({ status: r.status, startsAt: new Date(r.starts_at) }, now, manager) === null
    );
  }

  // --- Čtení ---

  async list(user: RequestUser, from?: string, to?: string): Promise<TireSlotView[]> {
    const now = new Date();
    const fromD = from ? new Date(from) : new Date(now.getTime() - 7 * 86_400_000);
    const toD = to ? new Date(to) : new Date(now.getTime() + 60 * 86_400_000);
    if (!Number.isFinite(fromD.getTime()) || !Number.isFinite(toD.getTime()) || toD <= fromD) {
      throw new BadRequestException('Neplatné období.');
    }
    if (toD.getTime() - fromD.getTime() > 400 * 86_400_000) {
      throw new BadRequestException('Období může mít nejvýš 400 dní.');
    }
    const manager = await this.isManager(user);
    const slots = await this.q<SlotRow>(
      `${SLOT_SELECT} WHERE s.tenant_id = $1 AND s.cancelled_at IS NULL
          AND s.starts_at < $3 AND s.ends_at > $2 ORDER BY s.starts_at LIMIT 1000`,
      [this.tenantId, fromD.toISOString(), toD.toISOString()],
    );
    if (!slots.length) return [];
    let bookings = await this.q<BookingRow>(
      `${BOOKING_SELECT} WHERE b.tenant_id = $1 AND b.slot_id = ANY($2::uuid[])
          AND b.status IN ('booked','done') ORDER BY b.created_at`,
      [this.tenantId, slots.map((s) => s.id)],
    );
    if (!manager) {
      const me = await this.personId(user.userId);
      bookings = bookings.filter((b) => me && b.person_id === me);
    }
    if (this.context.scope.type !== 'ORGANIZATION') {
      const keep = await Promise.all(bookings.map((b) => this.visible(b.asset_id)));
      bookings = bookings.filter((_, i) => keep[i]);
    }
    return slots.map((s) =>
      this.toSlot(
        s,
        now,
        manager,
        bookings
          .filter((b) => b.slot_id === s.id)
          .map((b) => this.toBooking(b, this.changeable(b, now, manager))),
      ),
    );
  }

  /** Nejbližší volné termíny (mimo uzávěrku, pokud nejde o správce). */
  private async suggestions(manager: boolean, limit = 3): Promise<TireSlotView[]> {
    const now = new Date();
    const after = new Date(now.getTime() + (manager ? 0 : CUTOFF_MS));
    const rows = await this.q<SlotRow>(
      `SELECT * FROM (${SLOT_SELECT} WHERE s.tenant_id = $1 AND s.cancelled_at IS NULL
          AND s.starts_at > $2) x WHERE x.booked < x.capacity ORDER BY x.starts_at LIMIT $3`,
      [this.tenantId, after.toISOString(), limit],
    );
    return rows.map((r) => this.toSlot(r, now, manager, []));
  }

  private async activeBooking(assetId: string): Promise<BookingRow | null> {
    const rows = await this.q<BookingRow>(
      `${BOOKING_SELECT} WHERE b.tenant_id = $1 AND b.asset_id = $2 AND b.status = 'booked' LIMIT 1`,
      [this.tenantId, assetId],
    );
    return rows[0] ?? null;
  }

  private async viewFor(
    asset: Asset,
    manager: boolean,
    personId: string | null,
  ): Promise<AssetTireBookingView> {
    const now = new Date();
    const reason = bookingDenial({
      isManager: manager,
      personId,
      holderType: asset.currentHolderType,
      holderId: asset.currentHolderId,
      responsiblePersonId: asset.responsiblePersonId,
      equipmentKind: await this.equipmentKind(asset),
    });
    const active = await this.activeBooking(asset.id);
    return {
      assetId: asset.id,
      assetName: asset.name,
      plate: asset.registrationPlate,
      booking: active
        ? this.toBooking(active, reason === null && this.changeable(active, now, manager))
        : null,
      canBook: reason === null,
      reason,
      suggestions: reason === null ? await this.suggestions(manager) : [],
    };
  }

  async assetBooking(user: RequestUser, assetId: string): Promise<AssetTireBookingView> {
    const asset = await this.assets.get(assetId);
    return this.viewFor(asset, await this.isManager(user), await this.personId(user.userId));
  }

  /** Vozidla, která uživatel drží nebo za ně odpovídá, se stavem přezutí. */
  async mine(user: RequestUser): Promise<{ linked: boolean; vehicles: AssetTireBookingView[] }> {
    const personId = await this.personId(user.userId);
    if (!personId) return { linked: false, vehicles: [] };
    const rows = await this.q<{ id: string }>(
      `SELECT a.id FROM assets a JOIN asset_categories c ON c.id = a.category_id
        WHERE a.tenant_id = $1 AND c.equipment_kind = 'vehicle' AND a.status <> 'retired'
          AND ((a.current_holder_type = 'person' AND a.current_holder_id = $2)
               OR a.responsible_person_id = $2)
        ORDER BY a.name LIMIT 50`,
      [this.tenantId, personId],
    );
    const manager = await this.isManager(user);
    const vehicles: AssetTireBookingView[] = [];
    for (const r of rows) {
      let asset: Asset;
      try {
        asset = await this.assets.get(r.id);
      } catch (e) {
        if (e instanceof NotFoundException) continue;
        throw e;
      }
      vehicles.push(await this.viewFor(asset, manager, personId));
    }
    return { linked: true, vehicles };
  }

  /**
   * E-maily o zrušení „někým jiným“: příjemce = osoba rezervace s e-mailem, kromě
   * rušícího samotného. Podklady se načtou v transakci, odeslání až po COMMIT.
   */
  private async notifyCancelled(
    user: RequestUser,
    bookingIds: string[],
    wholeSlot: boolean,
  ): Promise<void> {
    if (!bookingIds.length) return;
    const me = await this.personId(user.userId);
    const rows = await this.q<BookingRow & { email: string | null }>(
      `SELECT x.*, p2.email FROM (${BOOKING_SELECT} WHERE b.tenant_id = $1 AND b.id = ANY($2::uuid[])) x
         LEFT JOIN people p2 ON p2.id = x.person_id`,
      [this.tenantId, bookingIds],
    );
    const recipients = rows.filter((r) => cancelRecipient(r.person_id, r.email, me));
    if (!recipients.length) return;
    const actor = await this.q<{ name: string | null }>(
      `SELECT COALESCE(
          (SELECT p.name FROM people p WHERE p.id = $2),
          (SELECT u.name FROM users u WHERE u.id = $1),
          'správce') AS name`,
      [user.userId, me],
    );
    const cancelledBy = actor[0]?.name || 'správce';
    const notices: TireCancelNotice[] = recipients.map((r) => ({
      bookingId: r.id,
      assetId: r.asset_id,
      assetName: r.asset_name,
      plate: r.plate,
      personName: r.person_name ?? '',
      email: r.email,
      startsAt: new Date(r.starts_at),
      endsAt: new Date(r.ends_at),
      location: r.location,
      cancelledBy,
      wholeSlot,
    }));
    const tenantId = this.tenantId;
    this.context.afterCommit(() => this.notifier.tireBookingCancelled(tenantId, notices));
  }

  // --- Správa termínů ---

  async create(user: RequestUser, dto: CreateTireSlotsInput): Promise<{ created: number }> {
    let times: { startsAt: Date; endsAt: Date }[];
    try {
      times = generateSlotTimes(new Date(dto.startsAt), new Date(dto.endsAt), dto.durationMin);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    if (times[0].startsAt <= new Date())
      throw new BadRequestException('Termíny musí být v budoucnu.');
    await this.q(
      `INSERT INTO tire_change_slots (tenant_id, starts_at, ends_at, location, note, capacity, season, created_by)
       SELECT $1, t.s, t.e, $4, $5, $6, $7, $8
         FROM unnest($2::timestamptz[], $3::timestamptz[]) AS t(s, e)`,
      [
        this.tenantId,
        times.map((t) => t.startsAt.toISOString()),
        times.map((t) => t.endsAt.toISOString()),
        dto.location?.trim() || null,
        dto.note?.trim() || null,
        dto.capacity ?? 1,
        dto.season ?? null,
        user.userId,
      ],
    );
    await this.audit.record({
      action: 'asset.tireslots_created',
      targetType: 'tire_change_slot',
      targetId: null,
      after: { count: times.length, from: times[0].startsAt, season: dto.season ?? null },
    });
    return { created: times.length };
  }

  async cancelSlot(user: RequestUser, id: string): Promise<{ cancelledBookings: number }> {
    const rows = await this.q<{ id: string; cancelled_at: Date | null }>(
      `SELECT id, cancelled_at FROM tire_change_slots WHERE tenant_id = $1 AND id = $2 FOR UPDATE`,
      [this.tenantId, id],
    );
    if (!rows[0]) throw new NotFoundException('Termín neexistuje.');
    if (rows[0].cancelled_at) return { cancelledBookings: 0 };
    await this.q(
      `UPDATE tire_change_slots SET cancelled_at = clock_timestamp(), updated_at = now() WHERE id = $1`,
      [id],
    );
    const cancelled = await this.q<{ id: string }>(
      `UPDATE tire_change_bookings SET status = 'cancelled', cancelled_at = clock_timestamp(), cancelled_by = $3
        WHERE tenant_id = $1 AND slot_id = $2 AND status = 'booked' RETURNING id`,
      [this.tenantId, id, user.userId],
    );
    await this.notifyCancelled(
      user,
      cancelled.map((c) => c.id),
      true,
    );
    await this.audit.record({
      action: 'asset.tireslot_cancelled',
      targetType: 'tire_change_slot',
      targetId: id,
      after: { cancelledBookings: cancelled.length },
    });
    return { cancelledBookings: cancelled.length };
  }

  // --- Rezervace ---

  private async lockSlot(id: string): Promise<SlotRow> {
    const locked = await this.q<{ id: string }>(
      `SELECT id FROM tire_change_slots WHERE tenant_id = $1 AND id = $2 FOR UPDATE`,
      [this.tenantId, id],
    );
    if (!locked[0]) throw new NotFoundException('Termín neexistuje.');
    const rows = await this.q<SlotRow>(`${SLOT_SELECT} WHERE s.tenant_id = $1 AND s.id = $2`, [
      this.tenantId,
      id,
    ]);
    return rows[0];
  }

  private assertSlot(slot: SlotRow, manager: boolean): void {
    const denial = slotDenial(
      {
        startsAt: new Date(slot.starts_at),
        cancelledAt: slot.cancelled_at,
        capacity: slot.capacity,
        booked: Number(slot.booked),
      },
      new Date(),
      manager,
    );
    if (denial) throw new BadRequestException(denial);
  }

  /** Ověří, že uživatel smí s rezervacemi vozidla pracovat; vrací osobu rezervace. */
  private async eligible(
    user: RequestUser,
    assetId: string,
  ): Promise<{ asset: Asset; manager: boolean; personId: string | null }> {
    await this.q(`SELECT id FROM assets WHERE id = $1 FOR UPDATE`, [assetId]);
    const asset = await this.assets.get(assetId);
    const manager = await this.isManager(user);
    const me = await this.personId(user.userId);
    const input = {
      isManager: manager,
      personId: me,
      holderType: asset.currentHolderType,
      holderId: asset.currentHolderId,
      responsiblePersonId: asset.responsiblePersonId,
      equipmentKind: await this.equipmentKind(asset),
    };
    const denial = bookingDenial(input);
    if (denial) throw new ForbiddenException(denial);
    return { asset, manager, personId: bookingPerson(input) };
  }

  async book(user: RequestUser, slotId: string, assetId: string): Promise<TireBookingView> {
    const { asset, manager, personId } = await this.eligible(user, assetId);
    if (await this.activeBooking(asset.id)) {
      throw new BadRequestException(
        'Vozidlo už má termín přezutí. Použij Změnit nebo ho nejdřív zruš.',
      );
    }
    const slot = await this.lockSlot(slotId);
    this.assertSlot(slot, manager);
    const rows = await this.q<{ id: string }>(
      `INSERT INTO tire_change_bookings (tenant_id, slot_id, asset_id, person_id, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [this.tenantId, slotId, asset.id, personId, user.userId],
    );
    await this.audit.record({
      action: 'asset.tirebooking_created',
      targetType: 'asset',
      targetId: asset.id,
      after: { bookingId: rows[0].id, slotId },
    });
    return this.bookingView(rows[0].id, manager);
  }

  private async lockBooking(id: string): Promise<BookingRow> {
    const locked = await this.q<{ id: string }>(
      `SELECT id FROM tire_change_bookings WHERE tenant_id = $1 AND id = $2 FOR UPDATE`,
      [this.tenantId, id],
    );
    if (!locked[0]) throw new NotFoundException('Rezervace neexistuje.');
    const rows = await this.q<BookingRow>(
      `${BOOKING_SELECT} WHERE b.tenant_id = $1 AND b.id = $2`,
      [this.tenantId, id],
    );
    return rows[0];
  }

  private async bookingView(id: string, manager: boolean): Promise<TireBookingView> {
    const rows = await this.q<BookingRow>(
      `${BOOKING_SELECT} WHERE b.tenant_id = $1 AND b.id = $2`,
      [this.tenantId, id],
    );
    return this.toBooking(rows[0], this.changeable(rows[0], new Date(), manager));
  }

  async cancel(user: RequestUser, id: string): Promise<{ cancelled: true }> {
    const b = await this.lockBooking(id);
    const { manager } = await this.eligible(user, b.asset_id);
    const denial = cancelDenial(
      { status: b.status, startsAt: new Date(b.starts_at) },
      new Date(),
      manager,
    );
    if (denial) throw new BadRequestException(denial);
    await this.q(
      `UPDATE tire_change_bookings SET status = 'cancelled', cancelled_at = clock_timestamp(), cancelled_by = $2
        WHERE id = $1`,
      [id, user.userId],
    );
    await this.notifyCancelled(user, [id], false);
    await this.audit.record({
      action: 'asset.tirebooking_cancelled',
      targetType: 'asset',
      targetId: b.asset_id,
      after: { bookingId: id, slotId: b.slot_id },
    });
    return { cancelled: true };
  }

  async move(user: RequestUser, id: string, slotId: string): Promise<TireBookingView> {
    const b = await this.lockBooking(id);
    const { manager } = await this.eligible(user, b.asset_id);
    if (b.slot_id === slotId) return this.bookingView(id, manager);
    const denial = cancelDenial(
      { status: b.status, startsAt: new Date(b.starts_at) },
      new Date(),
      manager,
    );
    if (denial) throw new BadRequestException(denial);
    const slot = await this.lockSlot(slotId);
    this.assertSlot(slot, manager);
    await this.q(`UPDATE tire_change_bookings SET slot_id = $2 WHERE id = $1`, [id, slotId]);
    await this.audit.record({
      action: 'asset.tirebooking_moved',
      targetType: 'asset',
      targetId: b.asset_id,
      after: { bookingId: id, fromSlotId: b.slot_id, slotId },
    });
    return this.bookingView(id, manager);
  }

  /**
   * „Hotovo“ (správce): rezervace → done, u termínu se sezónou přezutí na sadu té
   * sezóny (pokud ji vozidlo má) a servisní záznam.
   */
  async complete(
    user: RequestUser,
    id: string,
  ): Promise<{ done: true; mountedSet: string | null; serviceRecordId: string }> {
    const b = await this.lockBooking(id);
    await this.assets.get(b.asset_id);
    if (b.status !== 'booked') throw new BadRequestException('Rezervace už není aktivní.');
    let mountedSet: string | null = null;
    if (b.season) {
      const rows = await this.tires.list(b.asset_id);
      mountedSet = pickSeasonSet(rows, b.season);
      if (mountedSet) await this.tires.mount(b.asset_id, mountedSet);
    }
    const season = b.season ? ` ${TIRE_SLOT_SEASON_LABELS[b.season]}` : '';
    const set = mountedSet
      ? ` – sada „${mountedSet}“`
      : b.season
        ? ' – sada pro sezónu není v evidenci'
        : '';
    const record = await this.assets.addService(b.asset_id, {
      kind: 'service',
      performedAt: new Date().toISOString(),
      provider: b.location ?? undefined,
      note: `Přezutí pneumatik${season}${set} (termín ${fmt.format(new Date(b.starts_at))})`,
    });
    await this.q(
      `UPDATE tire_change_bookings SET status = 'done', completed_at = clock_timestamp(), completed_by = $2
        WHERE id = $1`,
      [id, user.userId],
    );
    await this.audit.record({
      action: 'asset.tirebooking_done',
      targetType: 'asset',
      targetId: b.asset_id,
      after: { bookingId: id, mountedSet, serviceRecordId: record.id },
    });
    return { done: true, mountedSet, serviceRecordId: record.id };
  }
}
