import { HttpException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { RequestUser } from '../../../core/auth/jwt-auth.guard';
import { AuditService } from '../../../core/rbac/audit.service';
import { AuthzService } from '../../../core/rbac/authz.service';
import { PolicyService } from '../../../core/rbac/policy.service';
import {
  TenantContextService,
  type EffectiveScope,
} from '../../../core/tenancy/tenant-context.service';
import { channelFeatureKey, maskExternalRef, type ChannelActor } from '../channel.types';
import { ActionRegistry } from './action-registry.service';
import type {
  ActionErrorCode,
  ActionExecutionContext,
  ActionResult,
  AnyChannelAction,
} from './channel-action';

interface MembershipRow {
  membership_id: string;
  organization_id: string;
  organization_name: string;
  role: string;
}

/** Chyba akce s kódem pro kanál (nikdy neobsahuje data jiné firmy). */
export class ChannelActionError extends Error {
  constructor(
    readonly code: ActionErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const HTTP_CODES: Record<number, ActionErrorCode> = {
  400: 'INVALID_INPUT',
  402: 'LIMIT_REACHED',
  403: 'MISSING_PERMISSION',
  404: 'NOT_FOUND',
  409: 'INVALID_INPUT',
};

/**
 * Jediná cesta, kudy kanál spouští akci (spec §1, §8). Vynucuje vše, co web
 * vynucuje přes guard + interceptor:
 *  1. firma jen z AKTIVNÍCH členství uživatele – ověřuje se při každém volání,
 *  2. funkce kanálu zapnutá ve firmě (`channel_<kanál>`, EPIC-20),
 *  3. oprávnění akce (`AuthzService.can` – role z aktuálního členství + modul),
 *  4. `runInTenant` (RLS) + scope a policy jako `TenantTransactionInterceptor`,
 *  5. validace vstupu (Zod), potvrzení zápisů, audit `channel.<akce>`.
 */
@Injectable()
export class ActionExecutorService {
  private readonly logger = new Logger(ActionExecutorService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly registry: ActionRegistry,
    private readonly context: TenantContextService,
    private readonly authz: AuthzService,
    private readonly policy: PolicyService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  /** Aktivní členství uživatele (SECURITY DEFINER `my_memberships`, jen status active). */
  async memberships(userId: string): Promise<MembershipRow[]> {
    return this.dataSource.query(
      `SELECT membership_id, organization_id, organization_name, role FROM my_memberships($1)`,
      [userId],
    );
  }

  private webUrl = (path: string): string => {
    const base = (this.config.get<string>('PUBLIC_WEB_URL') ?? 'http://localhost:3000').replace(
      /\/$/,
      '',
    );
    return `${base}${path}`;
  };

  async execute(
    actor: ChannelActor,
    key: string,
    rawInput: unknown,
    opts: { confirmed?: boolean } = {},
  ): Promise<ActionResult> {
    const action = this.registry.get(key);
    if (!action) return this.fail(key, 'UNKNOWN_ACTION', 'Neznámá akce.');
    try {
      const data = await this.run(action, actor, rawInput, opts);
      return { ok: true, key, data };
    } catch (err) {
      if (err instanceof ChannelActionError) {
        const summary =
          err.code === 'CONFIRMATION_REQUIRED' ? this.summary(action, rawInput) : undefined;
        return { ok: false, key, code: err.code, message: err.message, summary };
      }
      if (err instanceof HttpException) {
        const status = err.getStatus();
        const body = err.getResponse();
        const message =
          typeof body === 'object' && body && 'message' in body
            ? String((body as { message: unknown }).message)
            : err.message;
        return this.fail(key, HTTP_CODES[status] ?? 'FAILED', message);
      }
      this.logger.error(`Akce ${key} selhala: ${(err as Error).message}`);
      return this.fail(key, 'FAILED', 'Akce se nepodařila.');
    }
  }

  private fail(key: string, code: ActionErrorCode, message: string): ActionResult {
    return { ok: false, key, code, message };
  }

  /** Shrnutí pro potvrzení (bez spuštění akce). */
  summary(action: AnyChannelAction, rawInput: unknown): string {
    const parsed = action.input.safeParse(rawInput ?? {});
    if (parsed.success && action.summarize) return action.summarize(parsed.data);
    return action.title;
  }

  private parse(action: AnyChannelAction, rawInput: unknown): unknown {
    const parsed = action.input.safeParse(rawInput ?? {});
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      throw new ChannelActionError(
        'INVALID_INPUT',
        `Neplatný vstup${first?.path.length ? ` (${first.path.join('.')})` : ''}: ${first?.message ?? ''}`,
      );
    }
    return parsed.data;
  }

  private async run(
    action: AnyChannelAction,
    actor: ChannelActor,
    rawInput: unknown,
    opts: { confirmed?: boolean },
  ): Promise<unknown> {
    const input = this.parse(action, rawInput);
    const ctx: ActionExecutionContext = {
      userId: actor.userId,
      tenantId: actor.tenantId,
      webUrl: this.webUrl,
    };

    if (action.scope === 'user') return action.execute(ctx, input);

    if (!actor.tenantId) {
      throw new ChannelActionError('NO_ORGANIZATION', 'Nejdřív vyber firmu.');
    }
    // 1) Firma jen z aktivních členství – ověřuje se při každém volání.
    const membership = (await this.memberships(actor.userId)).find(
      (m) => m.organization_id === actor.tenantId,
    );
    if (!membership) {
      throw new ChannelActionError(
        'INACTIVE_MEMBERSHIP',
        'Ve vybrané firmě nemáš aktivní členství.',
      );
    }
    const user: RequestUser = {
      userId: actor.userId,
      tenantId: membership.organization_id,
      tenantRole: membership.role,
      membershipId: membership.membership_id,
    };
    // 2) Funkce kanálu zapnutá ve firmě.
    if (!(await this.authz.isModuleActive(user, channelFeatureKey(actor.channel)))) {
      throw new ChannelActionError(
        'CHANNEL_DISABLED',
        `Ve firmě ${membership.organization_name} je tento kanál vypnutý.`,
      );
    }
    // 3) Oprávnění akce (role z aktuálního členství, stav modulu).
    if (action.permission) {
      const decision = await this.authz.can(user, action.permission);
      if (!decision.allowed) {
        throw new ChannelActionError(
          decision.reasonCode === 'INACTIVE_MODULE' ? 'CHANNEL_DISABLED' : 'MISSING_PERMISSION',
          decision.reasonCode === 'INACTIVE_MODULE'
            ? 'Tato funkce není ve firmě zapnutá.'
            : 'K této akci nemáš oprávnění.',
        );
      }
    }
    // 5a) Zápis jen s výslovným potvrzením.
    if (action.requiresConfirmation && !opts.confirmed) {
      throw new ChannelActionError('CONFIRMATION_REQUIRED', 'Akci je potřeba potvrdit.');
    }

    // 4) RLS + scope + policy, stejně jako HTTP request z webu.
    return this.context.runInTenant(user.tenantId, async () => {
      const rows: { scope_type: EffectiveScope['type']; scope_ref: string | null }[] =
        await this.context.manager.query(
          `SELECT ra.scope_type, ra.scope_ref
             FROM org_memberships m
             JOIN role_assignments ra ON ra.membership_id = m.id
            WHERE m.user_id = $1 AND m.tenant_id = $2 AND m.status = 'active'
            ORDER BY CASE ra.scope_type WHEN 'ORGANIZATION' THEN 0 ELSE 1 END
            LIMIT 1`,
          [user.userId, user.tenantId],
        );
      if (rows.length === 0) {
        throw new ChannelActionError('INACTIVE_MEMBERSHIP', 'Členství v této firmě není aktivní.');
      }
      this.context.setScope({ type: rows[0].scope_type, ref: rows[0].scope_ref });
      this.context.setActor(user.userId);
      const blocked = await this.policy.blockedReason(membership.membership_id);
      if (blocked) throw new ChannelActionError('POLICY_DENIED', blocked);

      const result = await action.execute(ctx, input);
      await this.audit.record({
        action: `channel.${action.key}`,
        targetType: 'channel_action',
        context: {
          channel: actor.channel,
          externalRef: maskExternalRef(actor.externalRef),
          kind: action.kind,
          result: 'ok',
        },
      });
      return result;
    });
  }
}
