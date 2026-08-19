import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { RequestUser } from '../auth/jwt-auth.guard';

/** Strojově čitelný důvod rozhodnutí (spec příloha B). */
export type ReasonCode =
  | 'ALLOWED'
  | 'HARD_DENY'
  | 'INACTIVE_MEMBERSHIP'
  | 'INACTIVE_MODULE'
  | 'MISSING_PERMISSION'
  | 'OUT_OF_SCOPE'
  | 'POLICY_DENIED';

export interface AuthzDecision {
  allowed: boolean;
  reasonCode: ReasonCode;
  permission: string;
}

/**
 * Centrální autorizace (EPIC-18 Fáze 1.3). Rozhoduje podle permission key
 * z role identity v AKTIVNÍ organizaci. Priorita dle zadání:
 * hard deny > neaktivní membership > chybějící permission > mimo scope >
 * policy > allow. Default DENY.
 *
 * Fáze 1.3 vynucuje vrstvu permission (role → role_permissions). Scope (Fáze 2),
 * entitlement (Fáze 3) a policy (Fáze 4) zatím propouští (ALLOWED) – doplní se.
 * Aktivní membership hlídá `TenantTransactionInterceptor` (0.3).
 */
/** Moduly, které lze per-organizace vypnout (core/asset/object/carrier jsou vždy on). */
export const CONTROLLED_MODULES = new Set([
  'product', 'membership', 'ticketing', 'gallery', 'rental', 'billing', 'access',
]);

@Injectable()
export class AuthzService {
  private readonly cache = new Map<string, { perms: Set<string>; exp: number }>();
  private readonly moduleCache = new Map<string, { inactive: Set<string>; exp: number }>();
  private readonly ttlMs = 60_000;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Neaktivní moduly organizace (opt-out; cache). Guard fáze → SECURITY DEFINER. */
  private async inactiveModules(orgId: string): Promise<Set<string>> {
    const hit = this.moduleCache.get(orgId);
    if (hit && hit.exp > Date.now()) return hit.inactive;
    const rows: { module_key: string }[] = await this.dataSource.query(
      `SELECT module_key FROM org_inactive_modules($1)`,
      [orgId],
    );
    const inactive = new Set(rows.map((r) => r.module_key));
    this.moduleCache.set(orgId, { inactive, exp: Date.now() + this.ttlMs });
    return inactive;
  }

  /** Invaliduje cache entitlementů org (po přepnutí modulu). */
  invalidateModules(orgId: string): void {
    this.moduleCache.delete(orgId);
  }

  /** Efektivní permission keys pro roli (systémová šablona), s krátkou cache. */
  async permissionsForRole(tenantRole: string): Promise<Set<string>> {
    const roleKey = tenantRole.toLowerCase();
    const hit = this.cache.get(roleKey);
    if (hit && hit.exp > Date.now()) return hit.perms;

    // SECURITY DEFINER funkce – čte permissions systémové role bez závislosti
    // na RLS (AuthzService běží ve fázi guardu, bez app.tenant_id).
    const rows: { key: string }[] = await this.dataSource.query(
      `SELECT key FROM role_permission_keys($1)`,
      [roleKey],
    );
    const perms = new Set(rows.map((r) => r.key));
    this.cache.set(roleKey, { perms, exp: Date.now() + this.ttlMs });
    return perms;
  }

  /** OWNER/ADMIN mají implicitně všechna oprávnění (jako object-ACL). */
  private isSuperRole(tenantRole: string): boolean {
    const k = tenantRole.toLowerCase();
    return k === 'owner' || k === 'admin';
  }

  /** Seznam efektivních permissions přihlášené identity (pro UI / verifikaci). */
  async listPermissions(user: RequestUser): Promise<string[]> {
    if (this.isSuperRole(user.tenantRole)) {
      const rows: { key: string }[] = await this.dataSource.query(
        `SELECT key FROM permissions ORDER BY key`,
      );
      return rows.map((r) => r.key);
    }
    return [...(await this.permissionsForRole(user.tenantRole))].sort();
  }

  /** Rozhodnutí allow/deny + reason pro daný permission key. */
  async can(user: RequestUser, permission: string): Promise<AuthzDecision> {
    // Entitlement modulu má přednost před rolí (i owner je u vypnutého modulu deny).
    const moduleKey = permission.split('.')[0];
    if (CONTROLLED_MODULES.has(moduleKey)) {
      const inactive = await this.inactiveModules(user.tenantId);
      if (inactive.has(moduleKey)) {
        return { allowed: false, reasonCode: 'INACTIVE_MODULE', permission };
      }
    }
    if (this.isSuperRole(user.tenantRole)) {
      return { allowed: true, reasonCode: 'ALLOWED', permission };
    }
    const perms = await this.permissionsForRole(user.tenantRole);
    if (!perms.has(permission)) {
      return { allowed: false, reasonCode: 'MISSING_PERMISSION', permission };
    }
    // Scope / policy: Fáze 2 (scope se řeší v dotazech) / Fáze 4. Zatím allow.
    return { allowed: true, reasonCode: 'ALLOWED', permission };
  }

  /** Vyhodí ForbiddenException, pokud identita permission nemá. */
  async assert(user: RequestUser, permission: string): Promise<void> {
    const d = await this.can(user, permission);
    if (!d.allowed) {
      throw new ForbiddenException(`Chybí oprávnění: ${permission} (${d.reasonCode})`);
    }
  }

  /** Invaliduje cache role (po editaci balíčku role). */
  invalidate(roleKey?: string): void {
    if (roleKey) this.cache.delete(roleKey.toLowerCase());
    else this.cache.clear();
  }
}
