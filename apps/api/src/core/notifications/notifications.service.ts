import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, EntityManager } from 'typeorm';
import {
  NOTIFICATIONS,
  NOTIFICATION_BY_KEY,
  exampleVariables,
  renderEmail,
  validateTemplate,
  type NotificationDef,
} from '@tagery/shared';
import { TenantContextService } from '../tenancy/tenant-context.service';
import { MailService, type MailAttachment } from '../mail/mail.service';
import { AuthzService } from '../rbac/authz.service';
import { AuditService } from '../rbac/audit.service';
import type { RequestUser } from '../auth/jwt-auth.guard';

export interface NotificationSettingView extends NotificationDef {
  enabled: boolean;
  subject: string;
  body: string;
  /** Text se liší od výchozího. */
  customized: boolean;
  /** Firma smí text upravit (u platformních ho spravuje Tagery). */
  editable: boolean;
}

export interface NotificationLogEntry {
  id: string;
  key: string;
  recipient: string;
  status: 'sent' | 'skipped' | 'failed' | 'test';
  error: string | null;
  createdAt: string;
}

export interface NotificationsOverview {
  isOwner: boolean;
  managerAccess: boolean;
  items: NotificationSettingView[];
  log: NotificationLogEntry[];
}

export interface SendOptions {
  tenantId: string | null;
  to: string;
  vars: Record<string, string>;
  /** Reference pro idempotenci (např. id položky u denní upomínky). */
  ref?: string;
  /** Přílohy e-mailu (např. .ics s termínem). */
  attachments?: MailAttachment[];
}

interface SettingRow {
  key: string;
  enabled: boolean | null;
  subject: string | null;
  body: string | null;
}

/** Dřívější typy webhooku (n8n) – zachované kvůli kompatibilitě. */
const LEGACY_WEBHOOK_TYPE: Record<string, string> = {
  password_reset: 'password_reset',
  email_verification: 'ověření e-mailu',
  invitation: 'přijetí pozvánky',
};

/** Role, které smí spravovat notifikace (manager jen s povolením ownera). */
const OWNER = 'owner';
const MANAGER = 'manager';

/**
 * E-mailové notifikace: šablony z katalogu (`@tagery/shared`) s přepsáním firmy
 * (`notification_settings`, RLS) nebo platformy (`platform_notification_templates`),
 * zapnutí/vypnutí provozních notifikací, odeslání přes MailService a záznam do
 * `notification_log`. Odeslání nikdy nevyhazuje – chyba e-mailu nesmí shodit akci.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly context: TenantContextService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly authz: AuthzService,
    private readonly audit: AuditService,
  ) {}

  /** Základ odkazů do aplikace. */
  appUrl(path = ''): string {
    const base = (this.config.get<string>('PUBLIC_WEB_URL') ?? 'http://localhost:3000').replace(
      /\/$/,
      '',
    );
    return `${base}${path}`;
  }

  private def(key: string): NotificationDef {
    const def = NOTIFICATION_BY_KEY.get(key);
    if (!def) throw new NotFoundException('Neznámá notifikace');
    return def;
  }

  /** Spustí `fn` v kontextu firmy (znovu použije běžící transakci téže firmy). */
  private async inTenant<T>(tenantId: string, fn: (m: EntityManager) => Promise<T>): Promise<T> {
    if (this.context.tenantId === tenantId) return fn(this.context.manager);
    return this.context.runInTenant(tenantId, () => fn(this.context.manager));
  }

  private async tenantRows(tenantId: string): Promise<Map<string, SettingRow>> {
    const rows = (await this.inTenant(tenantId, (m) =>
      m.query(`SELECT key, enabled, subject, body FROM notification_settings`),
    )) as SettingRow[];
    return new Map(rows.map((r) => [r.key, r]));
  }

  private async platformRows(): Promise<Map<string, { subject: string; body: string }>> {
    const rows = (await this.dataSource.query(
      `SELECT key, subject, body FROM platform_notification_templates`,
    )) as { key: string; subject: string; body: string }[];
    return new Map(rows.map((r) => [r.key, r]));
  }

  /** Účinná šablona a stav pro firmu (nebo platformu u `tenantId = null`). */
  private async resolve(
    def: NotificationDef,
    tenantId: string | null,
  ): Promise<{ enabled: boolean; subject: string; body: string }> {
    let subject = def.defaultSubject;
    let body = def.defaultBody;
    let enabled = def.system ? true : def.defaultEnabled;
    if (def.scope === 'platform') {
      const p = (await this.platformRows()).get(def.key);
      if (p) ({ subject, body } = p);
    } else if (tenantId) {
      const row = (await this.tenantRows(tenantId)).get(def.key);
      if (row) {
        subject = row.subject ?? subject;
        body = row.body ?? body;
        if (!def.system && row.enabled != null) enabled = row.enabled;
      }
    }
    return { enabled, subject, body };
  }

  private async firmName(tenantId: string | null): Promise<string> {
    if (!tenantId) return '';
    const rows = await this.dataSource.query(`SELECT name FROM tenants WHERE id = $1`, [tenantId]);
    return String(rows[0]?.name ?? '');
  }

  /** Je provozní notifikace pro firmu zapnutá? (Systémové vždy.) */
  async isEnabled(key: string, tenantId: string): Promise<boolean> {
    return (await this.resolve(this.def(key), tenantId)).enabled;
  }

  /** Odešle notifikaci (pokud je zapnutá). Nikdy nevyhazuje. */
  async send(key: string, opts: SendOptions): Promise<'sent' | 'disabled' | 'failed'> {
    try {
      const def = this.def(key);
      if (!opts.to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(opts.to)) return 'failed';
      const tpl = await this.resolve(def, opts.tenantId);
      if (!tpl.enabled) return 'disabled';
      const vars: Record<string, string> = {
        firma: await this.firmName(opts.tenantId),
        ...opts.vars,
      };
      const email = renderEmail(tpl.subject, tpl.body, vars);
      const result = await this.mail.sendRaw({
        to: opts.to,
        ...email,
        ...(opts.attachments?.length ? { attachments: opts.attachments } : {}),
        webhookPayload: {
          type: LEGACY_WEBHOOK_TYPE[key] ?? key,
          key,
          name: vars.jmeno,
          url: vars.odkaz,
          organizationName: vars.firma,
          vars,
        },
      });
      await this.log(
        opts.tenantId,
        key,
        opts.to,
        opts.ref ?? null,
        result.status === 'failed' ? 'failed' : 'sent',
        result.error ?? null,
      );
      return result.status === 'failed' ? 'failed' : 'sent';
    } catch (err) {
      this.logger.error(`Notifikace ${key} pro ${opts.to} selhala: ${String(err)}`);
      return 'failed';
    }
  }

  private async log(
    tenantId: string | null,
    key: string,
    recipient: string,
    ref: string | null,
    status: NotificationLogEntry['status'],
    error: string | null,
  ): Promise<void> {
    await this.dataSource
      .query(
        `INSERT INTO notification_log (tenant_id, key, recipient, ref, status, error)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [tenantId, key, recipient, ref, status, error?.slice(0, 500) ?? null],
      )
      .catch((e: Error) => this.logger.warn(`Záznam notifikace selhal: ${e.message}`));
  }

  /** Byla notifikace s touto referencí poslána od `since`? (idempotence upomínek) */
  async sentSince(tenantId: string, key: string, ref: string, since: Date): Promise<boolean> {
    const rows = await this.dataSource.query(
      `SELECT 1 FROM notification_log WHERE tenant_id = $1 AND key = $2 AND ref = $3
         AND status = 'sent' AND created_at >= $4 LIMIT 1`,
      [tenantId, key, ref, since],
    );
    return rows.length > 0;
  }

  /**
   * Aktivní uživatelé firmy, jejichž role má dané oprávnění (příjemci „správcovských"
   * notifikací). `roles` = jen tyto role (např. owner + manager u souhrnu).
   */
  async recipientsWithPermission(
    tenantId: string,
    permission: string,
    roles?: string[],
  ): Promise<{ email: string; name: string }[]> {
    const rows = (await this.inTenant(tenantId, (m) =>
      m.query(
        `SELECT DISTINCT u.email, u.name
           FROM org_memberships om
           JOIN users u ON u.id = om.user_id
          WHERE om.status = 'active' AND u.status = 'active'
            AND ($3::text[] IS NULL OR lower(om.role) = ANY($3::text[]))
            AND EXISTS (SELECT 1 FROM tenant_role_permission_keys($1, lower(om.role)) k
                         WHERE k.key = $2)`,
        [tenantId, permission, roles ?? null],
      ),
    )) as { email: string; name: string }[];
    return rows;
  }

  // --- Správa (Nastavení → Notifikace) ---

  private async managerAccess(tenantId: string): Promise<boolean> {
    const rows = await this.dataSource.query(`SELECT settings_json FROM tenants WHERE id = $1`, [
      tenantId,
    ]);
    return (
      (rows[0]?.settings_json as Record<string, unknown> | null)?.notificationsManagerAccess ===
      true
    );
  }

  /** Smí uživatel spravovat notifikace? Owner vždy, manager jen s povolením ownera. */
  async access(user: RequestUser): Promise<{ canManage: boolean; isOwner: boolean }> {
    const role = (await this.authz.roleInfo(user)).key;
    if (role === OWNER) return { canManage: true, isOwner: true };
    if (role === MANAGER && (await this.managerAccess(user.tenantId)))
      return { canManage: true, isOwner: false };
    return { canManage: false, isOwner: false };
  }

  private async assertCanManage(user: RequestUser): Promise<{ isOwner: boolean }> {
    const a = await this.access(user);
    if (!a.canManage)
      throw new ForbiddenException(
        'Notifikace spravuje vlastník firmy (manažer jen s jeho povolením).',
      );
    return a;
  }

  async overview(user: RequestUser): Promise<NotificationsOverview> {
    const { isOwner } = await this.assertCanManage(user);
    const rows = await this.tenantRows(user.tenantId);
    const platform = await this.platformRows();
    const items = NOTIFICATIONS.map((def) => {
      const row = rows.get(def.key);
      const p = platform.get(def.key);
      const subject =
        def.scope === 'platform'
          ? (p?.subject ?? def.defaultSubject)
          : (row?.subject ?? def.defaultSubject);
      const body =
        def.scope === 'platform' ? (p?.body ?? def.defaultBody) : (row?.body ?? def.defaultBody);
      return {
        ...def,
        enabled: def.system ? true : (row?.enabled ?? def.defaultEnabled),
        subject,
        body,
        customized: subject !== def.defaultSubject || body !== def.defaultBody,
        editable: def.scope === 'tenant',
      };
    });
    const log = await this.dataSource.query(
      `SELECT id, key, recipient, status, error, created_at FROM notification_log
        WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [user.tenantId],
    );
    return {
      isOwner,
      managerAccess: await this.managerAccess(user.tenantId),
      items,
      log: (log as Record<string, unknown>[]).map((r) => ({
        id: String(r.id),
        key: String(r.key),
        recipient: String(r.recipient),
        status: r.status as NotificationLogEntry['status'],
        error: (r.error as string | null) ?? null,
        createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      })),
    };
  }

  /** Zapnutí/vypnutí a úprava textu (null = výchozí text). */
  async update(
    user: RequestUser,
    key: string,
    patch: { enabled?: boolean; subject?: string | null; body?: string | null },
  ): Promise<NotificationsOverview> {
    await this.assertCanManage(user);
    const def = this.def(key);
    if (patch.enabled !== undefined && def.system)
      throw new BadRequestException('Systémovou notifikaci nelze vypnout.');
    const textChange = patch.subject !== undefined || patch.body !== undefined;
    if (textChange && def.scope !== 'tenant')
      throw new BadRequestException('Text této notifikace spravuje Tagery.');
    const rows = await this.tenantRows(user.tenantId);
    const cur = rows.get(key);
    const subject = patch.subject !== undefined ? patch.subject : (cur?.subject ?? null);
    const body = patch.body !== undefined ? patch.body : (cur?.body ?? null);
    if (textChange) {
      const errors = validateTemplate(def, subject ?? def.defaultSubject, body ?? def.defaultBody);
      if (errors.length) throw new BadRequestException(errors.join(' '));
    }
    // Uloží se jen odchylka od výchozího (výchozí text = null).
    const norm = (v: string | null, d: string) => (v == null || v === d ? null : v);
    const enabled = patch.enabled !== undefined ? patch.enabled : (cur?.enabled ?? null);
    await this.inTenant(user.tenantId, (m) =>
      m.query(
        `INSERT INTO notification_settings (tenant_id, key, enabled, subject, body, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (tenant_id, key) DO UPDATE SET enabled = EXCLUDED.enabled,
           subject = EXCLUDED.subject, body = EXCLUDED.body, updated_by = EXCLUDED.updated_by,
           updated_at = now()`,
        [
          user.tenantId,
          key,
          enabled,
          norm(subject, def.defaultSubject),
          norm(body, def.defaultBody),
          user.userId,
        ],
      ),
    );
    await this.audit.record({
      action: 'notification.updated',
      targetType: 'notification',
      targetId: key,
      after: { enabled: patch.enabled, textChanged: textChange },
    });
    return this.overview(user);
  }

  /** Owner povolí/zakáže manažerům správu notifikací. */
  async setManagerAccess(user: RequestUser, allowed: boolean): Promise<NotificationsOverview> {
    const { isOwner } = await this.assertCanManage(user);
    if (!isOwner) throw new ForbiddenException('Přístup manažerů může měnit jen vlastník.');
    await this.dataSource.query(
      `UPDATE tenants SET settings_json = COALESCE(settings_json, '{}'::jsonb) || jsonb_build_object('notificationsManagerAccess', $2::boolean)
        WHERE id = $1`,
      [user.tenantId, allowed],
    );
    await this.audit.record({
      action: 'notification.manager_access',
      targetType: 'tenant',
      targetId: user.tenantId,
      after: { allowed },
    });
    return this.overview(user);
  }

  /** Náhled e-mailu s ukázkovými hodnotami (text z editoru, ještě neuložený). */
  async preview(
    user: RequestUser | null,
    key: string,
    subject: string,
    body: string,
  ): Promise<{ subject: string; text: string; html: string; errors: string[] }> {
    if (user) await this.assertCanManage(user);
    const def = this.def(key);
    const vars = {
      ...exampleVariables(def),
      ...(user ? { firma: await this.firmName(user.tenantId) } : {}),
    };
    return { ...renderEmail(subject, body, vars), errors: validateTemplate(def, subject, body) };
  }

  /** Zkušební e-mail na adresu přihlášeného uživatele. */
  async test(
    user: RequestUser,
    key: string,
    subject: string,
    body: string,
    opts: { platform?: boolean } = {},
  ): Promise<{ to: string; status: string }> {
    if (!opts.platform) await this.assertCanManage(user);
    const def = this.def(key);
    const errors = validateTemplate(def, subject, body);
    if (errors.length) throw new BadRequestException(errors.join(' '));
    const rows = await this.dataSource.query(`SELECT email, name FROM users WHERE id = $1`, [
      user.userId,
    ]);
    const to = String(rows[0]?.email ?? '');
    const vars = {
      ...exampleVariables(def),
      jmeno: String(rows[0]?.name ?? ''),
      ...(opts.platform ? {} : { firma: await this.firmName(user.tenantId) }),
    };
    const email = renderEmail(`[TEST] ${subject}`, body, vars);
    const result = await this.mail.sendRaw({ to, ...email });
    await this.log(
      opts.platform ? null : user.tenantId,
      key,
      to,
      null,
      'test',
      result.error ?? null,
    );
    return { to, status: result.status };
  }

  // --- Platforma (texty systémových e-mailů Tagery) ---

  async platformTemplates(): Promise<NotificationSettingView[]> {
    const platform = await this.platformRows();
    return NOTIFICATIONS.filter((d) => d.scope === 'platform').map((def) => {
      const p = platform.get(def.key);
      const subject = p?.subject ?? def.defaultSubject;
      const body = p?.body ?? def.defaultBody;
      return {
        ...def,
        enabled: true,
        subject,
        body,
        customized: !!p,
        editable: true,
      };
    });
  }

  async updatePlatformTemplate(
    key: string,
    subject: string | null,
    body: string | null,
    actorUserId: string,
  ): Promise<NotificationSettingView[]> {
    const def = this.def(key);
    if (def.scope !== 'platform') throw new BadRequestException('Není platformní notifikace.');
    if (subject == null && body == null) {
      await this.dataSource.query(`DELETE FROM platform_notification_templates WHERE key = $1`, [
        key,
      ]);
    } else {
      const s = subject ?? def.defaultSubject;
      const b = body ?? def.defaultBody;
      const errors = validateTemplate(def, s, b);
      if (errors.length) throw new BadRequestException(errors.join(' '));
      await this.dataSource.query(
        `INSERT INTO platform_notification_templates (key, subject, body, updated_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (key) DO UPDATE SET subject = EXCLUDED.subject, body = EXCLUDED.body,
           updated_by = EXCLUDED.updated_by, updated_at = now()`,
        [key, s, b, actorUserId],
      );
    }
    return this.platformTemplates();
  }
}
