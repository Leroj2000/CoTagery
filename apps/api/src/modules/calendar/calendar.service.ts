import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  CALENDAR_SOURCE_PERMISSIONS,
  CALENDAR_SOURCES,
  isCalendarSource,
  type CalendarEventDto,
  type CalendarItem,
  type CalendarShareDto,
  type CalendarSource,
  type PublicCalendar,
} from '@tagery/shared';
import type { RequestUser } from '../../core/auth/jwt-auth.guard';
import { AuthzService } from '../../core/rbac/authz.service';
import { RateLimitService } from '../../core/resolver/rate-limit.service';
import { TenantContextService } from '../../core/tenancy/tenant-context.service';
import {
  allDayRange,
  buildIcs,
  generateShareToken,
  hashShareToken,
  isWellFormedToken,
  resolveRange,
  sortItems,
} from './calendar.logic';
import type {
  CreateCalendarEventDto,
  CreateCalendarShareDto,
  UpdateCalendarEventDto,
} from './dto/calendar.dto';
import { CalendarEvent } from './entities/calendar-event.entity';
import { CalendarShare } from './entities/calendar-share.entity';

const SERVICE_KIND_LABELS: Record<string, string> = {
  service: 'Servis',
  inspection: 'Revize',
  calibration: 'Kalibrace',
  repair: 'Oprava',
  warranty_claim: 'Reklamace',
};

/** Zdroje odvozené z evidence věcí – vyžadují rozsah celé firmy. */
const ASSET_SOURCES: ReadonlySet<CalendarSource> = new Set([
  'reservation',
  'loan',
  'service',
  'warranty',
  'inventory',
  'tire_slot',
]);

interface CollectOptions {
  /** Veřejný pohled: bez interních odkazů a bez poznámek k rezervacím. */
  public: boolean;
}

interface ShareLookupRow {
  share_id: string;
  tenant_id: string;
  label: string | null;
  sources: string[];
}

/**
 * Kalendář firmy: skládá položky z ručně založených událostí a z existující
 * evidence (rezervace, vrácení výpůjček, servis/STK, konce záruk, inventury).
 * Autentizovaná část běží v tenant kontextu (RLS); veřejná část najde odkaz
 * přes SECURITY DEFINER `calendar_share_lookup` a čte v kontextu jeho firmy.
 * Každý dotaz navíc explicitně filtruje `tenant_id`.
 */
@Injectable()
export class CalendarService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly context: TenantContextService,
    private readonly authz: AuthzService,
    private readonly rateLimit: RateLimitService,
  ) {}

  private get tenantId(): string {
    const id = this.context.tenantId;
    if (!id) throw new ForbiddenException('Chybí kontext firmy');
    return id;
  }

  /** Zdroje, které smí identita vidět (oprávnění, zapnutý modul, rozsah). */
  async allowedSources(user: RequestUser): Promise<CalendarSource[]> {
    const fullScope = this.context.scope.type === 'ORGANIZATION';
    const out: CalendarSource[] = [];
    for (const source of CALENDAR_SOURCES) {
      if (ASSET_SOURCES.has(source) && !fullScope) continue;
      if (source === 'inventory' && !(await this.authz.isModuleActive(user, 'inventory'))) {
        continue;
      }
      if (source === 'tire_slot' && !(await this.authz.isModuleActive(user, 'vehicles'))) {
        continue;
      }
      const decision = await this.authz.can(user, CALENDAR_SOURCE_PERMISSIONS[source]);
      if (decision.allowed) out.push(source);
    }
    return out;
  }

  async listForUser(
    user: RequestUser,
    from: string | undefined,
    to: string | undefined,
    requested: string[] | undefined,
  ): Promise<{ sources: CalendarSource[]; items: CalendarItem[] }> {
    const allowed = await this.allowedSources(user);
    const sources = requested?.length ? allowed.filter((s) => requested.includes(s)) : allowed;
    const range = resolveRange(from, to);
    const items = await this.collect(this.tenantId, sources, range, { public: false });
    return { sources: allowed, items };
  }

  // --- Skládání položek ---

  private async collect(
    tenantId: string,
    sources: CalendarSource[],
    range: { from: Date; to: Date },
    opts: CollectOptions,
  ): Promise<CalendarItem[]> {
    const q = this.context.manager;
    const from = range.from.toISOString();
    const to = range.to.toISOString();
    const items: CalendarItem[] = [];
    const want = new Set(sources);

    if (want.has('event')) {
      const rows: {
        id: string;
        title: string;
        description: string | null;
        location: string | null;
        starts_at: Date;
        ends_at: Date | null;
        all_day: boolean;
      }[] = await q.query(
        `SELECT id, title, description, location, starts_at, ends_at, all_day
           FROM calendar_events
          WHERE tenant_id = $1 AND starts_at < $3 AND COALESCE(ends_at, starts_at) >= $2
          ORDER BY starts_at LIMIT 2000`,
        [tenantId, from, to],
      );
      for (const r of rows) {
        items.push({
          id: `event:${r.id}`,
          source: 'event',
          title: r.title,
          start: new Date(r.starts_at).toISOString(),
          end: r.ends_at ? new Date(r.ends_at).toISOString() : null,
          allDay: r.all_day,
          description: r.description,
          location: r.location,
          href: opts.public ? null : `/admin/calendar?event=${r.id}`,
        });
      }
    }

    if (want.has('reservation')) {
      const rows: {
        id: string;
        from_at: Date;
        to_at: Date;
        status: string;
        purpose: string | null;
        asset_name: string;
      }[] = await q.query(
        `SELECT r.id, r.from_at, r.to_at, r.status, r.purpose, a.name AS asset_name
           FROM reservations r
           JOIN assets a ON a.id = r.asset_id AND a.tenant_id = r.tenant_id
          WHERE r.tenant_id = $1 AND r.status IN ('pending', 'approved', 'fulfilled')
            AND r.from_at IS NOT NULL AND r.from_at < $3 AND COALESCE(r.to_at, r.from_at) >= $2
          ORDER BY r.from_at LIMIT 2000`,
        [tenantId, from, to],
      );
      for (const r of rows) {
        items.push({
          id: `reservation:${r.id}`,
          source: 'reservation',
          title: `Rezervace: ${r.asset_name}${r.status === 'pending' ? ' (čeká na schválení)' : ''}`,
          start: new Date(r.from_at).toISOString(),
          end: r.to_at ? new Date(r.to_at).toISOString() : null,
          allDay: false,
          description: opts.public ? null : r.purpose,
          href: opts.public ? null : '/admin/reservations',
        });
      }
    }

    if (want.has('loan')) {
      const rows: { id: string; name: string; due_at: Date }[] = await q.query(
        `SELECT a.id, a.name, a.due_at FROM assets a
          WHERE a.tenant_id = $1 AND a.due_at IS NOT NULL AND a.status <> 'retired'
            AND a.due_at >= $2 AND a.due_at < $3
          ORDER BY a.due_at LIMIT 2000`,
        [tenantId, from, to],
      );
      for (const r of rows) {
        items.push({
          id: `loan:${r.id}:${new Date(r.due_at).getTime()}`,
          source: 'loan',
          title: `Vrácení: ${r.name}`,
          start: new Date(r.due_at).toISOString(),
          end: null,
          allDay: false,
          href: opts.public ? null : `/admin/assets/${r.id}`,
        });
      }
    }

    if (want.has('service')) {
      // Jen poslední záznam pro každou věc a druh/interval – starší termíny jsou
      // nahrazené novějším servisem.
      const rows: {
        id: string;
        asset_id: string;
        kind: string;
        next_due_at: Date;
        provider: string | null;
        asset_name: string;
      }[] = await q.query(
        `SELECT x.id, x.asset_id, x.kind, x.next_due_at, x.provider, a.name AS asset_name
           FROM (
             SELECT DISTINCT ON (s.asset_id, COALESCE(s.plan_code, s.kind))
                    s.id, s.asset_id, s.kind, s.next_due_at, s.provider
               FROM asset_services s
              WHERE s.tenant_id = $1
              ORDER BY s.asset_id, COALESCE(s.plan_code, s.kind),
                       COALESCE(s.performed_at, s.created_at) DESC
           ) x
           JOIN assets a ON a.id = x.asset_id AND a.tenant_id = $1
          WHERE a.status <> 'retired' AND x.next_due_at IS NOT NULL
            AND x.next_due_at >= $2 AND x.next_due_at < $3
          ORDER BY x.next_due_at LIMIT 2000`,
        [tenantId, from, to],
      );
      for (const r of rows) {
        const day = allDayRange(new Date(r.next_due_at).toISOString());
        items.push({
          id: `service:${r.id}`,
          source: 'service',
          title: `${SERVICE_KIND_LABELS[r.kind] ?? 'Servis'}: ${r.asset_name}`,
          start: day.start,
          end: day.end,
          allDay: true,
          description: opts.public ? null : r.provider,
          href: opts.public ? null : `/admin/assets/${r.asset_id}`,
        });
      }
    }

    if (want.has('warranty')) {
      const rows: {
        id: string;
        asset_id: string;
        title: string;
        ends_on: string;
        asset_name: string;
      }[] = await q.query(
        `SELECT w.id, w.asset_id, w.title, w.ends_on::text AS ends_on, a.name AS asset_name
             FROM asset_warranties w
             JOIN assets a ON a.id = w.asset_id AND a.tenant_id = w.tenant_id
            WHERE w.tenant_id = $1 AND a.status <> 'retired'
              AND w.ends_on >= $2::date AND w.ends_on < $3::date
            ORDER BY w.ends_on LIMIT 2000`,
        [tenantId, from, to],
      );
      for (const r of rows) {
        const day = allDayRange(r.ends_on);
        items.push({
          id: `warranty:${r.id}`,
          source: 'warranty',
          title: `Konec záruky: ${r.asset_name}`,
          start: day.start,
          end: day.end,
          allDay: true,
          description: opts.public ? null : r.title,
          href: opts.public ? null : `/admin/assets/${r.asset_id}`,
        });
      }
    }

    if (want.has('inventory')) {
      const rows: {
        id: string;
        kind: string;
        status: string;
        period_from: string;
        period_to: string | null;
      }[] = await q.query(
        `SELECT id, kind, status, period_from::text AS period_from, period_to::text AS period_to
             FROM inventory_checks
            WHERE tenant_id = $1 AND period_from IS NOT NULL
              AND period_from < $3::date AND COALESCE(period_to, period_from) >= $2::date
            ORDER BY period_from LIMIT 500`,
        [tenantId, from, to],
      );
      for (const r of rows) {
        const start = allDayRange(r.period_from).start;
        const end = allDayRange(r.period_to ?? r.period_from).end;
        items.push({
          id: `inventory:${r.id}`,
          source: 'inventory',
          title: `${r.kind === 'vehicle' ? 'Inventura vozidel' : 'Inventura'}${r.status === 'closed' ? ' (uzavřená)' : ''}`,
          start,
          end,
          allDay: true,
          href: opts.public ? null : `/admin/inventory/${r.id}`,
        });
      }
    }

    if (want.has('tire_slot')) {
      // Termíny přezutí i se SPZ rezervovaných vozidel (schváleno i pro veřejné
      // sdílení); jména lidí jen v přihlášeném kalendáři.
      const rows: {
        id: string;
        starts_at: Date;
        ends_at: Date;
        location: string | null;
        capacity: number;
        plates: string[] | null;
        people: string[] | null;
      }[] = await q.query(
        `SELECT s.id, s.starts_at, s.ends_at, s.location, s.capacity,
                array_remove(array_agg(COALESCE(a.registration_plate, a.name) ORDER BY b.created_at), NULL) AS plates,
                array_remove(array_agg(p.name ORDER BY b.created_at), NULL) AS people
           FROM tire_change_slots s
           LEFT JOIN tire_change_bookings b
             ON b.slot_id = s.id AND b.tenant_id = s.tenant_id AND b.status IN ('booked', 'done')
           LEFT JOIN assets a ON a.id = b.asset_id AND a.tenant_id = s.tenant_id
           LEFT JOIN people p ON p.id = b.person_id AND p.tenant_id = s.tenant_id
          WHERE s.tenant_id = $1 AND s.cancelled_at IS NULL AND s.starts_at < $3 AND s.ends_at >= $2
          GROUP BY s.id
          ORDER BY s.starts_at LIMIT 2000`,
        [tenantId, from, to],
      );
      for (const r of rows) {
        const plates = r.plates ?? [];
        const free = r.capacity - plates.length;
        const title = plates.length
          ? `Přezutí: ${plates.join(', ')}${free > 0 ? ` (volno ${free})` : ''}`
          : 'Přezutí – volný termín';
        items.push({
          id: `tire_slot:${r.id}`,
          source: 'tire_slot',
          title,
          start: new Date(r.starts_at).toISOString(),
          end: new Date(r.ends_at).toISOString(),
          allDay: false,
          location: r.location,
          description: opts.public || !r.people?.length ? null : r.people.join(', '),
          href: opts.public ? null : '/admin/calendar?tab=tires',
        });
      }
    }

    return sortItems(items);
  }

  // --- Ručně založené události ---

  async listEvents(from?: string, to?: string): Promise<CalendarEventDto[]> {
    const range = resolveRange(from, to);
    const rows = await this.context.manager
      .getRepository(CalendarEvent)
      .createQueryBuilder('e')
      .where('e.tenantId = :tenantId', { tenantId: this.tenantId })
      .andWhere('e.startsAt < :to', { to: range.to })
      .andWhere('COALESCE(e.endsAt, e.startsAt) >= :from', { from: range.from })
      .orderBy('e.startsAt', 'ASC')
      .take(2000)
      .getMany();
    return rows.map(toEventDto);
  }

  async createEvent(dto: CreateCalendarEventDto): Promise<CalendarEventDto> {
    const { startsAt, endsAt } = validInterval(dto.startsAt, dto.endsAt ?? null);
    const repo = this.context.manager.getRepository(CalendarEvent);
    const saved = await repo.save(
      repo.create({
        tenantId: this.tenantId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        location: dto.location?.trim() || null,
        startsAt,
        endsAt,
        allDay: dto.allDay ?? false,
        createdBy: this.context.userId ?? null,
      }),
    );
    return toEventDto(saved);
  }

  async updateEvent(id: string, dto: UpdateCalendarEventDto): Promise<CalendarEventDto> {
    const repo = this.context.manager.getRepository(CalendarEvent);
    const event = await repo.findOne({ where: { id, tenantId: this.tenantId } });
    if (!event) throw new NotFoundException('Událost neexistuje');
    if (dto.title !== undefined) event.title = dto.title.trim();
    if (dto.description !== undefined) event.description = dto.description?.trim() || null;
    if (dto.location !== undefined) event.location = dto.location?.trim() || null;
    if (dto.allDay !== undefined) event.allDay = dto.allDay;
    const interval = validInterval(
      dto.startsAt ?? event.startsAt.toISOString(),
      dto.endsAt === undefined ? (event.endsAt?.toISOString() ?? null) : dto.endsAt,
    );
    event.startsAt = interval.startsAt;
    event.endsAt = interval.endsAt;
    return toEventDto(await repo.save(event));
  }

  async deleteEvent(id: string): Promise<void> {
    const result = await this.context.manager
      .getRepository(CalendarEvent)
      .delete({ id, tenantId: this.tenantId });
    if (!result.affected) throw new NotFoundException('Událost neexistuje');
  }

  // --- Sdílení ---

  async listShares(): Promise<CalendarShareDto[]> {
    const rows = await this.context.manager
      .getRepository(CalendarShare)
      .find({ where: { tenantId: this.tenantId }, order: { createdAt: 'DESC' }, take: 200 });
    return rows.map(toShareDto);
  }

  async createShare(
    user: RequestUser,
    dto: CreateCalendarShareDto,
  ): Promise<{ share: CalendarShareDto; token: string }> {
    const allowed = await this.allowedSources(user);
    const sources = [...new Set(dto.sources)].filter(isCalendarSource);
    if (sources.length === 0) throw new BadRequestException('Vyber aspoň jeden zdroj událostí');
    const denied = sources.filter((s) => !allowed.includes(s));
    if (denied.length > 0) {
      throw new ForbiddenException(`Nemáš oprávnění sdílet: ${denied.join(', ')}`);
    }
    let expiresAt: Date | null = null;
    if (dto.expiresAt) {
      expiresAt = new Date(dto.expiresAt);
      if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date()) {
        throw new BadRequestException('Platnost odkazu musí končit v budoucnu');
      }
    }
    const token = generateShareToken();
    const repo = this.context.manager.getRepository(CalendarShare);
    const saved = await repo.save(
      repo.create({
        tenantId: this.tenantId,
        tokenHash: hashShareToken(token),
        label: dto.label?.trim() || null,
        sources,
        expiresAt,
        createdBy: this.context.userId ?? null,
      }),
    );
    return { share: toShareDto(saved), token };
  }

  async revokeShare(id: string): Promise<CalendarShareDto> {
    const repo = this.context.manager.getRepository(CalendarShare);
    const share = await repo.findOne({ where: { id, tenantId: this.tenantId } });
    if (!share) throw new NotFoundException('Odkaz neexistuje');
    if (!share.revokedAt) {
      share.revokedAt = new Date();
      await repo.save(share);
    }
    return toShareDto(share);
  }

  // --- Veřejná část (bez JWT) ---

  async publicCalendar(
    token: string,
    ip: string,
    from?: string,
    to?: string,
  ): Promise<PublicCalendar> {
    const tokenOk = await this.rateLimit.allow(
      `calendar:token:${hashShareToken(token)}`,
      600,
      3600,
    );
    const ipOk = await this.rateLimit.allow(`calendar:ip:${ip}`, 3000, 3600);
    if (!tokenOk || !ipOk) {
      throw new HttpException(
        'Příliš mnoho požadavků, zkuste později',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    // Jednotná odpověď pro neplatný, zneplatněný i expirovaný odkaz.
    const notFound = new NotFoundException('Odkaz na kalendář neexistuje nebo vypršel');
    if (!isWellFormedToken(token)) throw notFound;
    const rows: ShareLookupRow[] = await this.dataSource.query(
      'SELECT * FROM calendar_share_lookup($1)',
      [hashShareToken(token)],
    );
    if (rows.length === 0) throw notFound;
    const share = rows[0];
    const sources = share.sources.filter(isCalendarSource);
    const range = resolveRange(from, to);
    return this.context.runInTenant(share.tenant_id, async () => {
      await this.context.manager.query(
        `UPDATE calendar_shares SET last_accessed_at = now()
          WHERE tenant_id = $1 AND id = $2
            AND (last_accessed_at IS NULL OR last_accessed_at < now() - interval '5 minutes')`,
        [share.tenant_id, share.share_id],
      );
      const items = await this.collect(share.tenant_id, sources, range, { public: true });
      return {
        title: share.label ?? 'Kalendář',
        // Veřejně jen pole události – bez interních odkazů a ID firmy.
        items: items.map(({ href: _href, ...rest }) => rest),
      };
    });
  }

  async publicIcs(token: string, ip: string): Promise<string> {
    const now = new Date();
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 3, 1));
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 10, 1));
    const cal = await this.publicCalendar(token, ip, from.toISOString(), to.toISOString());
    return buildIcs(cal.title, cal.items, now);
  }
}

function validInterval(
  startsAtRaw: string,
  endsAtRaw: string | null,
): { startsAt: Date; endsAt: Date | null } {
  const startsAt = new Date(startsAtRaw);
  if (!Number.isFinite(startsAt.getTime())) throw new BadRequestException('Neplatný začátek');
  const endsAt = endsAtRaw ? new Date(endsAtRaw) : null;
  if (endsAt && (!Number.isFinite(endsAt.getTime()) || endsAt < startsAt)) {
    throw new BadRequestException('Konec musí být po začátku');
  }
  return { startsAt, endsAt };
}

function toEventDto(e: CalendarEvent): CalendarEventDto {
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    location: e.location,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt ? e.endsAt.toISOString() : null,
    allDay: e.allDay,
  };
}

function toShareDto(s: CalendarShare): CalendarShareDto {
  return {
    id: s.id,
    label: s.label,
    sources: s.sources.filter(isCalendarSource),
    expiresAt: s.expiresAt ? s.expiresAt.toISOString() : null,
    revokedAt: s.revokedAt ? s.revokedAt.toISOString() : null,
    lastAccessedAt: s.lastAccessedAt ? s.lastAccessedAt.toISOString() : null,
    createdAt: s.createdAt.toISOString(),
  };
}
