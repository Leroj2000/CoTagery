import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { TenantContextService } from '../../core/tenancy/tenant-context.service';
import { NotificationsService } from '../../core/notifications/notifications.service';
import { ModulesService } from '../../core/rbac/modules.service';
import { Person } from '../../core/domain/entities/person.entity';
import { Asset } from './entities/asset.entity';
import type { Reservation } from './entities/reservation.entity';
import { AssetService, type AssetNotifier } from './asset.service';
import { MaintenanceService } from './maintenance.service';
import { PurchaseService } from './purchase.service';

const TZ = 'Europe/Prague';
const HOUR_MS = 60 * 60 * 1000;
/** Denní souhrn se posílá od této hodiny (pražského času). */
const DIGEST_HOUR = 7;

function fmtDay(d: Date | null): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat('cs-CZ', { timeZone: TZ, dateStyle: 'medium' }).format(d);
}

function fmtDateTime(d: Date | null): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat('cs-CZ', {
    timeZone: TZ,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}

function pragueParts(now = new Date()): { day: string; hour: number } {
  const day = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ }).format(now);
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(
      now,
    ),
  );
  return { day, hour };
}

/**
 * Provozní e-mailové notifikace položek (Nastavení → Notifikace): výdej osobě,
 * nový / vyřízený požadavek, denní upomínka po termínu vrácení a ranní souhrn
 * „Vyžaduje pozornost". Všechny jsou ve výchozím stavu vypnuté – zapíná je firma.
 * Chyba odeslání nikdy neshodí původní akci.
 */
@Injectable()
export class AssetNotificationsService implements OnModuleInit, OnModuleDestroy, AssetNotifier {
  private readonly logger = new Logger(AssetNotificationsService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly context: TenantContextService,
    private readonly notifications: NotificationsService,
    private readonly modules: ModulesService,
    private readonly assets: AssetService,
    private readonly maintenance: MaintenanceService,
    private readonly purchases: PurchaseService,
  ) {}

  onModuleInit(): void {
    this.assets.setNotifier(this);
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.tick(), HOUR_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async person(id: string | null): Promise<Person | null> {
    if (!id) return null;
    return this.context.manager.getRepository(Person).findOne({ where: { id } });
  }

  /** Položka vydána / půjčena / předána osobě → e-mail té osobě. */
  async assetIssued(asset: Asset, personId: string, dueAt: Date | null): Promise<void> {
    try {
      const tenantId = this.context.tenantId!;
      if (!(await this.notifications.isEnabled('asset_issued', tenantId))) return;
      const p = await this.person(personId);
      if (!p?.email) return;
      await this.notifications.send('asset_issued', {
        tenantId,
        to: p.email,
        ref: asset.id,
        vars: {
          jmeno: p.name,
          polozka: asset.name,
          inventarni_cislo: asset.inventoryNumber ?? '—',
          termin_vraceni: dueAt ? fmtDay(dueAt) : 'bez termínu',
          odkaz: this.notifications.appUrl('/admin/me'),
        },
      });
    } catch (err) {
      this.logger.warn(`Notifikace výdeje selhala: ${String(err)}`);
    }
  }

  /** Nový požadavek → uživatelé, kteří smí požadavky schvalovat. */
  async reservationCreated(r: Reservation): Promise<void> {
    try {
      const tenantId = this.context.tenantId!;
      if (!(await this.notifications.isEnabled('reservation_created', tenantId))) return;
      const asset = await this.context.manager.getRepository(Asset).findOne({
        where: { id: r.assetId },
      });
      const requester = await this.person(r.requestedById);
      const recipients = await this.notifications.recipientsWithPermission(
        tenantId,
        'asset.reservation.approve',
      );
      for (const to of recipients) {
        await this.notifications.send('reservation_created', {
          tenantId,
          to: to.email,
          ref: r.id,
          vars: {
            jmeno: to.name,
            polozka: asset?.name ?? '—',
            zadatel: requester?.name ?? '—',
            termin: `${fmtDateTime(r.fromAt)} – ${fmtDateTime(r.toAt)}`,
            ucel: r.purpose ?? '—',
            odkaz: this.notifications.appUrl('/admin/reservations'),
          },
        });
      }
    } catch (err) {
      this.logger.warn(`Notifikace nového požadavku selhala: ${String(err)}`);
    }
  }

  /** Požadavek schválen / zamítnut → žadatel. */
  async reservationDecided(r: Reservation): Promise<void> {
    if (r.status !== 'approved' && r.status !== 'rejected') return;
    try {
      const tenantId = this.context.tenantId!;
      if (!(await this.notifications.isEnabled('reservation_decided', tenantId))) return;
      const p = await this.person(r.requestedById);
      if (!p?.email) return;
      const asset = await this.context.manager.getRepository(Asset).findOne({
        where: { id: r.assetId },
      });
      await this.notifications.send('reservation_decided', {
        tenantId,
        to: p.email,
        ref: r.id,
        vars: {
          jmeno: p.name,
          polozka: asset?.name ?? '—',
          stav: r.status === 'approved' ? 'schválen' : 'zamítnut',
          termin: `${fmtDateTime(r.fromAt)} – ${fmtDateTime(r.toAt)}`,
        },
      });
    } catch (err) {
      this.logger.warn(`Notifikace vyřízení požadavku selhala: ${String(err)}`);
    }
  }

  // --- Plánované (hodinový běh) ---

  /** Hodinový běh přes všechny firmy: upomínky po termínu a ranní souhrn. */
  async tick(now = new Date()): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const tenants = (await this.dataSource.query(
        `SELECT id FROM tenants WHERE id <> '00000000-0000-0000-0000-000000000000'`,
      )) as { id: string }[];
      for (const t of tenants) {
        try {
          await this.forTenant(t.id, now);
        } catch (err) {
          this.logger.warn(`Plánované notifikace firmy ${t.id} selhaly: ${String(err)}`);
        }
      }
    } finally {
      this.running = false;
    }
  }

  async forTenant(tenantId: string, now = new Date()): Promise<void> {
    const overdueOn = await this.notifications.isEnabled('return_overdue', tenantId);
    const digestOn = await this.notifications.isEnabled('attention_digest', tenantId);
    if (!overdueOn && !digestOn) return;
    const { day, hour } = pragueParts(now);
    if (hour < DIGEST_HOUR) return;
    await this.context.runInTenant(tenantId, async () => {
      if (overdueOn) await this.overdueReminders(tenantId, now);
      if (digestOn) await this.digest(tenantId, day);
    });
  }

  /** Upomínka držiteli – nejvýš jednou za ~20 h na položku. */
  private async overdueReminders(tenantId: string, now: Date): Promise<void> {
    const overdue = (
      await this.context.manager.getRepository(Asset).find({
        where: { currentHolderType: 'person' },
      })
    ).filter((a) => a.dueAt && a.dueAt.getTime() < now.getTime());
    for (const a of overdue) {
      if (
        await this.notifications.sentSince(
          tenantId,
          'return_overdue',
          a.id,
          new Date(now.getTime() - 20 * HOUR_MS),
        )
      )
        continue;
      const p = await this.person(a.currentHolderId);
      if (!p?.email) continue;
      const days = Math.max(1, Math.floor((now.getTime() - a.dueAt!.getTime()) / (24 * HOUR_MS)));
      await this.notifications.send('return_overdue', {
        tenantId,
        to: p.email,
        ref: a.id,
        vars: {
          jmeno: p.name,
          polozka: a.name,
          inventarni_cislo: a.inventoryNumber ?? '—',
          termin_vraceni: fmtDay(a.dueAt),
          dni_po_terminu: String(days),
        },
      });
    }
  }

  /** Souhrn pro ownera a manažery – jednou denně, jen když něco je. */
  private async digest(tenantId: string, day: string): Promise<void> {
    const recipients = await this.notifications.recipientsWithPermission(
      tenantId,
      'asset.item.view',
      ['owner', 'manager'],
    );
    if (!recipients.length) return;
    const att = await this.assets.attention();
    const lines: string[] = [];
    if (att.overdue.length) lines.push(`• Po termínu vrácení: ${att.overdue.length}`);
    if (att.pendingConfirmations.length)
      lines.push(`• Nepotvrzená převzetí: ${att.pendingConfirmations.length}`);
    if (att.openIssues.length) lines.push(`• Otevřené závady: ${att.openIssues.length}`);
    if (att.dueServices.length)
      lines.push(`• Blížící se revize a servis: ${att.dueServices.length}`);
    if (await this.modules.isActive('vehicles')) {
      const due = await this.maintenance.due();
      if (due.length) lines.push(`• Servis vozidel a strojů: ${due.length}`);
    }
    if (await this.modules.isActive('purchase')) {
      const w = await this.purchases.expiring();
      if (w.length) lines.push(`• Končící záruky (30 dní): ${w.length}`);
    }
    if (!lines.length) return;
    for (const r of recipients) {
      const ref = `${day}:${r.email}`;
      if (
        await this.notifications.sentSince(
          tenantId,
          'attention_digest',
          ref,
          new Date(Date.now() - 23 * HOUR_MS),
        )
      )
        continue;
      await this.notifications.send('attention_digest', {
        tenantId,
        to: r.email,
        ref,
        vars: {
          jmeno: r.name,
          souhrn: lines.join('\n'),
          odkaz: this.notifications.appUrl('/admin/attention'),
        },
      });
    }
  }
}
