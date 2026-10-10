import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import {
  CUSTOM_ROLE_PREFIX,
  OWNER_ROLE_KEY,
  canManageRank,
  delegateRolePermissions,
  isSystemRoleKey,
  withImpliedPermissions,
  type PermissionInfo,
} from '@tagery/shared';
import type { RequestUser } from '../auth/jwt-auth.guard';
import { TenantContextService } from '../tenancy/tenant-context.service';
import { AuditService } from './audit.service';
import { AuthzService, type RoleInfo } from './authz.service';

/** Role firmy pro UI správy rolí. */
export interface RoleView {
  key: string;
  name: string;
  description: string | null;
  rank: number;
  /** Systémová šablona (owner/admin/…); jinak vlastní role firmy. */
  system: boolean;
  /** Systémová šablona upravená pro tuto firmu. */
  customized: boolean;
  allPermissions: boolean;
  permissions: string[];
  memberCount: number;
  /** Smí aktér roli upravit (úroveň pod ním, ne vlastník). */
  editable: boolean;
  /** Smí aktér roli přidělit uživateli. */
  assignable: boolean;
}

export interface RolesOverview {
  catalog: PermissionInfo[];
  roles: RoleView[];
  actor: {
    roleKey: string;
    roleName: string;
    rank: number;
    canManage: boolean;
    /** Oprávnění, která aktér smí v rolích zapínat/vypínat (= která sám má). */
    grantable: string[];
  };
}

interface RoleRow {
  id: string;
  tenant_id: string | null;
  key: string;
  name: string;
  description: string | null;
  rank: number;
  all_permissions: boolean;
}

/** Odstraní diakritiku a nepovolené znaky – základ klíče vlastní role. */
function slugify(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 30) || 'role'
  );
}

/**
 * Správa rolí firmy: matice oprávnění, hierarchie a delegace.
 *
 * Pravidla (vynucená zde, ne jen v UI):
 * - role se spravují jen pod vlastní úrovní (`rank`), vlastník je neměnný,
 * - aktér smí v roli zapnout/vypnout jen oprávnění, která sám má,
 * - systémová šablona se při první úpravě zkopíruje do firmy (copy-on-write),
 *   „Obnovit výchozí" kopii smaže,
 * - vlastní roli nelze smazat, dokud je někomu přidělená.
 * Data jsou pod RLS (šablony jen ke čtení, zápis jen do rolí této firmy).
 */
@Injectable()
export class RolesService {
  constructor(
    private readonly context: TenantContextService,
    private readonly authz: AuthzService,
    private readonly audit: AuditService,
  ) {}

  private get tenantId(): string {
    return this.context.tenantId!;
  }

  private async catalog(): Promise<PermissionInfo[]> {
    return this.context.manager.query(`SELECT key, sensitivity FROM permissions ORDER BY key`);
  }

  /** Efektivní řádky rolí firmy: firemní úprava má přednost před šablonou. */
  private async effectiveRows(): Promise<RoleRow[]> {
    const rows: RoleRow[] = await this.context.manager.query(
      `SELECT id, tenant_id, key, name, description, rank, all_permissions FROM roles`,
    );
    const byKey = new Map<string, RoleRow>();
    for (const r of rows) {
      const prev = byKey.get(r.key);
      if (!prev || (prev.tenant_id === null && r.tenant_id !== null)) byKey.set(r.key, r);
    }
    return [...byKey.values()];
  }

  private async permsOf(row: RoleRow, catalog: PermissionInfo[]): Promise<string[]> {
    if (row.all_permissions) return catalog.map((p) => p.key);
    const rows: { key: string }[] = await this.context.manager.query(
      `SELECT p.key FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id
        WHERE rp.role_id = $1 ORDER BY p.key`,
      [row.id],
    );
    return rows.map((r) => r.key);
  }

  private async actor(user: RequestUser) {
    const [info, perms] = await Promise.all([
      this.authz.roleInfo(user),
      this.authz.effectivePermissions(user),
    ]);
    return { info, perms, canManage: perms.has('core.role.manage') };
  }

  async overview(user: RequestUser): Promise<RolesOverview> {
    // Sekvenčně: v tenant kontextu běží všechny dotazy na jednom transakčním spojení.
    const catalog = await this.catalog();
    const rows = await this.effectiveRows();
    const actor = await this.actor(user);
    const counts: { key: string; n: number }[] = await this.context.manager.query(
      `SELECT lower(role) AS key, count(*)::int AS n FROM org_memberships
        WHERE status = 'active' GROUP BY 1`,
    );
    const links: { role_id: string; key: string }[] = await this.context.manager.query(
      `SELECT rp.role_id, p.key FROM role_permissions rp
         JOIN permissions p ON p.id = rp.permission_id
        WHERE rp.role_id = ANY($1::uuid[]) ORDER BY p.key`,
      [rows.map((r) => r.id)],
    );
    const permsByRole = new Map<string, string[]>();
    for (const l of links)
      permsByRole.set(l.role_id, [...(permsByRole.get(l.role_id) ?? []), l.key]);
    const allKeys = catalog.map((p) => p.key);
    const count = new Map(counts.map((c) => [c.key, c.n]));
    const isOwner = actor.info.key === OWNER_ROLE_KEY;
    const roles = rows.map((r): RoleView => {
      const below = canManageRank(actor.info.rank, r.rank);
      return {
        key: r.key,
        name: r.name,
        description: r.description,
        rank: r.rank,
        system: isSystemRoleKey(r.key),
        customized: isSystemRoleKey(r.key) && r.tenant_id !== null,
        allPermissions: r.all_permissions,
        permissions: r.all_permissions ? allKeys : (permsByRole.get(r.id) ?? []),
        memberCount: count.get(r.key) ?? 0,
        editable: actor.canManage && r.key !== OWNER_ROLE_KEY && below,
        assignable: actor.canManage && (below || (isOwner && r.key === OWNER_ROLE_KEY)),
      };
    });
    roles.sort((a, b) => b.rank - a.rank || a.name.localeCompare(b.name, 'cs'));
    return {
      catalog,
      roles,
      actor: {
        roleKey: actor.info.key,
        roleName: actor.info.name,
        rank: actor.info.rank,
        canManage: actor.canManage,
        grantable: [...actor.perms].sort(),
      },
    };
  }

  /** Najde efektivní řádek role firmy podle klíče, nebo 404. */
  private async row(key: string): Promise<RoleRow> {
    const k = key.toLowerCase();
    const row = (await this.effectiveRows()).find((r) => r.key === k);
    if (!row) throw new NotFoundException('Role neexistuje');
    return row;
  }

  private assertManageable(actorRank: number, row: RoleRow): void {
    if (row.key === OWNER_ROLE_KEY) {
      throw new ForbiddenException('Vlastník má vždy všechna oprávnění a nelze ho upravit.');
    }
    if (!canManageRank(actorRank, row.rank)) {
      throw new ForbiddenException('Tuto roli může spravovat jen nadřízená role.');
    }
  }

  private async replacePermissions(roleId: string, keys: string[]): Promise<void> {
    await this.context.manager.query(`DELETE FROM role_permissions WHERE role_id = $1`, [roleId]);
    if (keys.length === 0) return;
    await this.context.manager.query(
      `INSERT INTO role_permissions (role_id, permission_id)
       SELECT $1, p.id FROM permissions p WHERE p.key = ANY($2::text[])`,
      [roleId, keys],
    );
  }

  /** Normalizuje požadovaná oprávnění: delegace + závislosti „zobrazit". */
  private resolvePermissions(
    requested: string[],
    current: string[],
    actorPerms: Set<string>,
    catalog: PermissionInfo[],
  ): string[] {
    const keys = catalog.map((p) => p.key);
    const delegated = delegateRolePermissions(requested, current, actorPerms);
    // Závislé „zobrazit" se doplní jen tam, kde ho aktér smí udělit.
    const implied = withImpliedPermissions(delegated, keys).filter(
      (k) => delegated.includes(k) || actorPerms.has(k),
    );
    return implied;
  }

  async create(
    user: RequestUser,
    dto: { name: string; description?: string; belowRole: string; permissions?: string[] },
  ): Promise<RolesOverview> {
    const actor = await this.actor(user);
    const catalog = await this.catalog();
    const parent = await this.row(dto.belowRole);
    // Nová role leží těsně pod zvolenou rolí; ta musí být nejvýš na úrovni aktéra.
    if (
      parent.rank > actor.info.rank ||
      (parent.key === OWNER_ROLE_KEY && actor.info.key !== OWNER_ROLE_KEY)
    ) {
      throw new ForbiddenException('Novou roli lze založit jen pod vlastní úrovní.');
    }
    const rank = parent.rank - 1;
    if (rank < 1) throw new BadRequestException('Pod touto rolí už nelze založit další úroveň.');
    const requested = dto.permissions ?? (await this.permsOf(parent, catalog));
    const permissions = this.resolvePermissions(requested, [], actor.perms, catalog);

    const key = `${CUSTOM_ROLE_PREFIX}${slugify(dto.name)}_${randomBytes(3).toString('hex')}`;
    const [inserted] = (await this.context.manager.query(
      `INSERT INTO roles (tenant_id, key, name, description, rank, all_permissions, based_on, system_flag)
       VALUES ($1, $2, $3, $4, $5, false, $6, false) RETURNING id`,
      [this.tenantId, key, dto.name.trim(), dto.description?.trim() || null, rank, parent.key],
    )) as { id: string }[];
    await this.replacePermissions(inserted.id, permissions);
    await this.audit.record({
      action: 'role.created',
      targetType: 'role',
      targetId: inserted.id,
      after: { key, name: dto.name.trim(), rank, permissions },
    });
    this.authz.invalidate(this.tenantId);
    return this.overview(user);
  }

  async update(
    user: RequestUser,
    key: string,
    dto: { name?: string; description?: string; permissions: string[] },
  ): Promise<RolesOverview> {
    const actor = await this.actor(user);
    const catalog = await this.catalog();
    const row = await this.row(key);
    this.assertManageable(actor.info.rank, row);
    const before = await this.permsOf(row, catalog);
    const after = this.resolvePermissions(dto.permissions, before, actor.perms, catalog);
    const name = dto.name?.trim() || row.name;
    const description =
      dto.description !== undefined ? dto.description.trim() || null : row.description;

    let roleId = row.id;
    if (row.tenant_id === null) {
      // První úprava systémové šablony → kopie pro tuto firmu.
      const [copy] = (await this.context.manager.query(
        `INSERT INTO roles (tenant_id, key, name, description, rank, all_permissions, based_on, system_flag)
         VALUES ($1, $2, $3, $4, $5, false, $2, true) RETURNING id`,
        [this.tenantId, row.key, name, description, row.rank],
      )) as { id: string }[];
      roleId = copy.id;
    } else {
      await this.context.manager.query(
        `UPDATE roles SET name = $2, description = $3, all_permissions = false, updated_at = now()
          WHERE id = $1`,
        [roleId, name, description],
      );
    }
    await this.replacePermissions(roleId, after);

    const added = after.filter((k) => !before.includes(k));
    const removed = before.filter((k) => !after.includes(k));
    await this.audit.record({
      action: 'role.updated',
      targetType: 'role',
      targetId: roleId,
      before: { key: row.key, name: row.name, permissions: before },
      after: { key: row.key, name, permissions: after, added, removed },
    });
    this.authz.invalidate(this.tenantId);
    return this.overview(user);
  }

  /** Systémová šablona: smaže firemní úpravu (vrátí výchozí oprávnění). */
  async reset(user: RequestUser, key: string): Promise<RolesOverview> {
    const actor = await this.actor(user);
    const row = await this.row(key);
    this.assertManageable(actor.info.rank, row);
    if (!isSystemRoleKey(row.key))
      throw new BadRequestException('Výchozí stav má jen systémová role.');
    if (row.tenant_id !== null) {
      await this.context.manager.query(`DELETE FROM roles WHERE id = $1`, [row.id]);
      await this.audit.record({
        action: 'role.reset',
        targetType: 'role',
        targetId: row.id,
        before: { key: row.key },
      });
      this.authz.invalidate(this.tenantId);
    }
    return this.overview(user);
  }

  /** Smaže vlastní roli – jen když ji nikdo nemá přidělenou. */
  async remove(user: RequestUser, key: string): Promise<RolesOverview> {
    const actor = await this.actor(user);
    const row = await this.row(key);
    this.assertManageable(actor.info.rank, row);
    if (isSystemRoleKey(row.key)) throw new BadRequestException('Systémovou roli nelze smazat.');
    const [{ n }] = (await this.context.manager.query(
      `SELECT count(*)::int AS n FROM org_memberships WHERE lower(role) = $1`,
      [row.key],
    )) as { n: number }[];
    if (n > 0) {
      throw new ConflictException(
        `Roli má přidělenou ${n} uživatel(ů) – nejdřív jim přiděl jinou.`,
      );
    }
    await this.context.manager.query(`DELETE FROM roles WHERE id = $1`, [row.id]);
    await this.audit.record({
      action: 'role.deleted',
      targetType: 'role',
      targetId: row.id,
      before: { key: row.key, name: row.name },
    });
    this.authz.invalidate(this.tenantId);
    return this.overview(user);
  }

  /**
   * Ověří, že aktér smí uživateli přidělit roli `roleKey` (pozvánka i změna).
   * Vrací info o roli. `targetUserId` = měněný uživatel (jinak nová pozvánka).
   */
  async assertAssignable(
    user: RequestUser,
    roleKey: string,
    targetUserId?: string,
  ): Promise<RoleInfo> {
    const actor = await this.authz.roleInfo(user);
    const role = await this.authz.roleInfoFor(this.tenantId, roleKey);
    if (role.rank === 0) throw new BadRequestException('Neznámá role.');
    const actorIsOwner = actor.key === OWNER_ROLE_KEY;
    if (role.key === OWNER_ROLE_KEY ? !actorIsOwner : !canManageRank(actor.rank, role.rank)) {
      throw new ForbiddenException('Tuto roli může přidělit jen nadřízená role.');
    }
    if (!targetUserId) return role;
    if (targetUserId === user.userId) throw new ForbiddenException('Vlastní roli si nelze měnit.');

    const [target] = (await this.context.manager.query(
      `SELECT role FROM org_memberships WHERE user_id = $1`,
      [targetUserId],
    )) as { role: string }[];
    if (!target) throw new NotFoundException('Uživatel neexistuje');
    const current = await this.authz.roleInfoFor(this.tenantId, target.role);
    if (!actorIsOwner && !canManageRank(actor.rank, current.rank)) {
      throw new ForbiddenException('Roli nadřízeného nebo rovnocenného uživatele nelze měnit.');
    }
    // Firma musí mít vždy aspoň jednoho aktivního vlastníka.
    if (current.key === OWNER_ROLE_KEY && role.key !== OWNER_ROLE_KEY) {
      const [{ n }] = (await this.context.manager.query(
        `SELECT count(*)::int AS n FROM org_memberships
          WHERE lower(role) = 'owner' AND status = 'active' AND user_id <> $1`,
        [targetUserId],
      )) as { n: number }[];
      if (n === 0) throw new ConflictException('Firma musí mít aspoň jednoho vlastníka.');
    }
    return role;
  }
}
