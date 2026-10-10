import { randomBytes } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { isSystemRoleKey, membershipRoleKey, type TenantRole } from '@tagery/shared';
import type { RequestUser } from '../../auth/jwt-auth.guard';
import { RolesService } from '../../rbac/roles.service';
import { AuthzService } from '../../rbac/authz.service';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { AuditService } from '../../rbac/audit.service';
import { AuthService } from '../../auth/auth.service';
import { User } from '../../auth/entities/user.entity';
import { OrgMembership } from '../../auth/entities/membership.entity';
import { RoleAssignment } from '../../auth/entities/role-assignment.entity';
import { CategoryLinksService } from '../people/category-links.service';
import type { InviteUserDto, UpdateRoleDto } from './dto/users.dto';

/** Veřejný pohled na uživatele (bez password_hash). */
export interface UserView {
  id: string;
  email: string;
  name: string;
  /** Klíč role v této firmě (systémová velkými, vlastní `c_…`). */
  tenantRole: string;
  status: string;
  createdAt: Date;
  /** Kategorie uživatele v této firmě (many-to-many). */
  categoryIds: string[];
}

/** `users.tenant_role` je historický sloupec (domovská role) – nese jen systémové role. */
function legacyRole(role: string): TenantRole {
  return (isSystemRoleKey(role) ? role.toUpperCase() : 'VIEWER') as TenantRole;
}

function toView(u: User, categoryIds: string[] = []): UserView {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    tenantRole: u.tenantRole,
    status: u.status,
    createdAt: u.createdAt,
    categoryIds,
  };
}

/**
 * Správa uživatelů tenanta (EPIC-03/01). Tenant-scoped přes RLS
 * (TenantContextService.manager). Invite = založení uživatele s dočasným
 * heslem, které se jednou vrátí adminovi k předání.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly context: TenantContextService,
    private readonly audit: AuditService,
    private readonly links: CategoryLinksService,
    private readonly auth: AuthService,
    private readonly roles: RolesService,
    private readonly authz: AuthzService,
  ) {}

  private repo(): Repository<User> {
    return this.context.manager.getRepository(User);
  }

  async listViews(): Promise<UserView[]> {
    // Uživatelé = členové AKTUÁLNÍ organizace. `users` NEMÁ RLS, proto se scope-uje
    // přes `org_memberships` (to RLS má) – jinak by výpis vracel uživatele všech
    // firem (cross-tenant únik). Role je efektivní role v této org (z membershipu).
    const rows = (await this.context.manager.query(
      `SELECT u.id, u.email, u.name, m.role, u.status, u.created_at
         FROM org_memberships m
         JOIN users u ON u.id = m.user_id
        ORDER BY u.created_at DESC
        LIMIT 500`,
    )) as Array<{
      id: string;
      email: string;
      name: string;
      role: string;
      status: string;
      created_at: Date;
    }>;
    const catMap = await this.links.mapFor(
      'user',
      rows.map((r) => r.id),
    );
    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      tenantRole: r.role,
      status: r.status,
      createdAt: r.created_at,
      categoryIds: catMap.get(r.id) ?? [],
    }));
  }

  /** Nastaví kategorie uživatele v aktuální firmě (many-to-many). */
  async setCategories(userId: string, categoryIds: string[]): Promise<void> {
    // Gate: uživatel musí být člen aktuální firmy (org_memberships má RLS).
    const m = await this.context.manager
      .getRepository(OrgMembership)
      .findOne({ where: { userId } });
    if (!m) throw new NotFoundException('Uživatel neexistuje');
    await this.links.set('user', userId, categoryIds);
  }

  async invite(actor: RequestUser, dto: InviteUserDto): Promise<{ user: UserView }> {
    // Pozvat lze jen s rolí pod vlastní úrovní (žádná eskalace přes pozvánku).
    const role = membershipRoleKey((await this.roles.assertAssignable(actor, dto.tenantRole)).key);
    const existing = await this.repo().findOne({ where: { email: dto.email } });
    if (existing) throw new BadRequestException('Uživatel s tímto e-mailem už existuje');

    // Náhodný neznámý secret drží účet nepřihlásitelný i při chybě status gate.
    const passwordHash = await AuthService.hashPassword(randomBytes(32).toString('base64url'));
    const user = await this.repo().save(
      this.repo().create({
        tenantId: this.context.tenantId,
        email: dto.email,
        name: dto.name,
        passwordHash,
        tenantRole: legacyRole(role),
        status: 'pending',
      }),
    );
    // EPIC-18: členství + role_assignment v aktuální organizaci.
    await this.ensureMembership(user.id, role);
    await this.audit.record({
      action: 'member.invited',
      targetType: 'user',
      targetId: user.id,
      after: { email: user.email, role },
    });
    const tenant = await this.context.manager.query(`SELECT name FROM tenants WHERE id = $1`, [
      this.context.tenantId,
    ]);
    await this.auth.createInvitation(
      user,
      this.context.tenantId!,
      String(tenant[0]?.name ?? 'organizace'),
      this.context.manager,
    );
    return { user: { ...toView(user), tenantRole: role } };
  }

  /** Založí (nebo srovná roli) membershipu identity v aktuální organizaci. */
  private async ensureMembership(userId: string, role: string): Promise<void> {
    const mRepo = this.context.manager.getRepository(OrgMembership);
    const raRepo = this.context.manager.getRepository(RoleAssignment);
    let m = await mRepo.findOne({ where: { tenantId: this.context.tenantId, userId } });
    if (!m) {
      m = await mRepo.save(
        mRepo.create({ tenantId: this.context.tenantId, userId, role, status: 'active' }),
      );
    } else if (m.role !== role) {
      m.role = role;
      await mRepo.save(m);
    }
    const ra = await raRepo.findOne({ where: { membershipId: m.id } });
    if (!ra) {
      await raRepo.save(
        raRepo.create({
          tenantId: this.context.tenantId,
          membershipId: m.id,
          roleKey: role,
          scopeType: 'ORGANIZATION',
          validFrom: new Date(),
        }),
      );
    } else if (ra.roleKey !== role) {
      ra.roleKey = role;
      await raRepo.save(ra);
    }
  }

  async updateRole(actor: RequestUser, id: string, dto: UpdateRoleDto): Promise<UserView> {
    const user = await this.get(id);
    // Hierarchie: jen role pod sebou, jen podřízeným, ne sobě, vždy ≥ 1 vlastník.
    const role = membershipRoleKey(
      (await this.roles.assertAssignable(actor, dto.tenantRole, id)).key,
    );
    const [prev] = (await this.context.manager.query(
      `SELECT role FROM org_memberships WHERE user_id = $1`,
      [id],
    )) as { role: string }[];
    if (isSystemRoleKey(role)) user.tenantRole = legacyRole(role);
    const saved = await this.repo().save(user);
    // Srovnej roli v membershipu/role_assignmentu (autorizace čte roli z membershipu).
    await this.ensureMembership(user.id, role);
    this.authz.invalidate(this.context.tenantId!);
    await this.audit.record({
      action: 'member.role_changed',
      targetType: 'user',
      targetId: user.id,
      before: { role: prev?.role ?? null },
      after: { role },
    });
    return { ...toView(saved), tenantRole: role };
  }

  async setStatus(id: string, status: 'active' | 'suspended'): Promise<UserView> {
    const user = await this.get(id);
    user.status = status;
    return toView(await this.repo().save(user));
  }

  private async get(id: string): Promise<User> {
    // Gate: uživatel musí být členem AKTUÁLNÍ organizace. `org_memberships` má RLS,
    // takže membership se najde jen pro naši firmu → brání změně role/stavu cizího
    // uživatele podle id (`users` nemá RLS a šlo by přepsat cross-tenant).
    const member = await this.context.manager
      .getRepository(OrgMembership)
      .findOne({ where: { userId: id } });
    if (!member) throw new NotFoundException('Uživatel neexistuje');
    const user = await this.repo().findOne({ where: { id } });
    if (!user) throw new NotFoundException('Uživatel neexistuje');
    return user;
  }
}
