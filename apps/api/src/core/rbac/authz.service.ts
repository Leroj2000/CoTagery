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

/** Efektivní role identity ve firmě. */
export interface RoleInfo {
  key: string;
  name: string;
  /** Úroveň v hierarchii (owner 100 … scan_only 10; neznámá role 0). */
  rank: number;
  allPermissions: boolean;
}

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
 * Role se bere aktuální z členství a vyhodnocuje se ve firmě (firemní úprava
 * role > systémová šablona). Entitlement modulu má přednost, scope se řeší
 * v dotazech, policy a aktivní membership v `TenantTransactionInterceptor`.
 */
/** Moduly, které lze per-organizace vypnout (core/asset/object/carrier jsou vždy on). */
export const CONTROLLED_MODULES = new Set([
  'product',
  'membership',
  'ticketing',
  'gallery',
  'rental',
  'billing',
  'access',
]);

@Injectable()
export class AuthzService {
  private readonly cache = new Map<string, { perms: Set<string>; exp: number }>();
  private readonly roleCache = new Map<string, { info: RoleInfo; exp: number }>();
  private readonly memberCache = new Map<string, { role: string; exp: number }>();
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

  /** Efektivní role identity ve firmě (pro hierarchii a delegaci). */
  async roleInfo(user: RequestUser): Promise<RoleInfo> {
    const key = await this.currentRoleKey(user);
    return this.roleInfoFor(user.tenantId, key);
  }

  /** Role podle klíče ve firmě (firemní úprava > systémová šablona). */
  async roleInfoFor(tenantId: string, roleKey: string): Promise<RoleInfo> {
    const cacheKey = `${tenantId}:${roleKey.toLowerCase()}`;
    const hit = this.roleCache.get(cacheKey);
    if (hit && hit.exp > Date.now()) return hit.info;
    const rows: { key: string; name: string; rank: number; all_permissions: boolean }[] =
      await this.dataSource.query(
        `SELECT key, name, rank, all_permissions FROM tenant_role_info($1, $2)`,
        [tenantId, roleKey],
      );
    // Neznámá role (smazaná vlastní role) = nejnižší úroveň bez oprávnění.
    const info: RoleInfo = rows[0]
      ? {
          key: rows[0].key,
          name: rows[0].name,
          rank: rows[0].rank,
          allPermissions: rows[0].all_permissions,
        }
      : { key: roleKey.toLowerCase(), name: roleKey, rank: 0, allPermissions: false };
    this.roleCache.set(cacheKey, { info, exp: Date.now() + this.ttlMs });
    return info;
  }

  /**
   * Aktuální role z členství (ne z JWT – access token žije 15 min a odebraná
   * role musí přestat platit hned). Bez aktivního členství zůstane role z
   * tokenu; aktivní členství stejně vynucuje TenantTransactionInterceptor.
   */
  private async currentRoleKey(user: RequestUser): Promise<string> {
    const cacheKey = `${user.userId}:${user.tenantId}`;
    const hit = this.memberCache.get(cacheKey);
    if (hit && hit.exp > Date.now()) return hit.role;
    const rows: { organization_id: string; role: string }[] = await this.dataSource.query(
      `SELECT organization_id, role FROM my_memberships($1)`,
      [user.userId],
    );
    const role = rows.find((r) => r.organization_id === user.tenantId)?.role ?? user.tenantRole;
    this.memberCache.set(cacheKey, { role, exp: Date.now() + this.ttlMs });
    return role;
  }

  /** Efektivní permission keys role ve firmě, s krátkou cache. */
  async permissionsForRole(tenantId: string, roleKey: string): Promise<Set<string>> {
    const cacheKey = `${tenantId}:${roleKey.toLowerCase()}`;
    const hit = this.cache.get(cacheKey);
    if (hit && hit.exp > Date.now()) return hit.perms;

    // SECURITY DEFINER funkce – čte roli firmy / systémovou šablonu bez závislosti
    // na RLS (AuthzService běží ve fázi guardu, bez app.tenant_id).
    const rows: { key: string }[] = await this.dataSource.query(
      `SELECT key FROM tenant_role_permission_keys($1, $2)`,
      [tenantId, roleKey],
    );
    const perms = new Set(rows.map((r) => r.key));
    this.cache.set(cacheKey, { perms, exp: Date.now() + this.ttlMs });
    return perms;
  }

  /** Efektivní oprávnění přihlášené identity. */
  async effectivePermissions(user: RequestUser): Promise<Set<string>> {
    return this.permissionsForRole(user.tenantId, await this.currentRoleKey(user));
  }

  /** Seznam efektivních permissions přihlášené identity (pro UI / verifikaci). */
  async listPermissions(user: RequestUser): Promise<string[]> {
    return [...(await this.effectivePermissions(user))].sort();
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
    // Vlastník (all_permissions) i role s implicitním katalogem projdou přes
    // tenant_role_permission_keys, které jim vrací celý katalog.
    const perms = await this.effectivePermissions(user);
    if (!perms.has(permission)) {
      return { allowed: false, reasonCode: 'MISSING_PERMISSION', permission };
    }
    // Scope se řeší v dotazech, policy v interceptoru.
    return { allowed: true, reasonCode: 'ALLOWED', permission };
  }

  /** Stav modulu nezávislý na roli; používá se pro class-level module gate. */
  async isModuleActive(user: RequestUser, moduleKey: string): Promise<boolean> {
    if (!CONTROLLED_MODULES.has(moduleKey)) return true;
    return !(await this.inactiveModules(user.tenantId)).has(moduleKey);
  }

  async assertModuleActive(user: RequestUser, moduleKey: string): Promise<void> {
    if (!(await this.isModuleActive(user, moduleKey))) {
      throw new ForbiddenException(`Modul není aktivní: ${moduleKey} (INACTIVE_MODULE)`);
    }
  }

  /** Vyhodí ForbiddenException, pokud identita permission nemá. */
  async assert(user: RequestUser, permission: string): Promise<void> {
    const d = await this.can(user, permission);
    if (!d.allowed) {
      throw new ForbiddenException(`Chybí oprávnění: ${permission} (${d.reasonCode})`);
    }
  }

  /** Invaliduje cache rolí firmy (po editaci rolí) – nebo vše. */
  invalidate(tenantId?: string): void {
    if (!tenantId) {
      this.cache.clear();
      this.roleCache.clear();
      this.memberCache.clear();
      return;
    }
    for (const map of [this.cache, this.roleCache] as Map<string, unknown>[]) {
      for (const k of map.keys()) if (k.startsWith(`${tenantId}:`)) map.delete(k);
    }
    for (const k of this.memberCache.keys())
      if (k.endsWith(`:${tenantId}`)) this.memberCache.delete(k);
  }
}
