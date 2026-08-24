import { randomBytes } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import type { TenantRole } from '@tagery/shared';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { AuditService } from '../../rbac/audit.service';
import { AuthService } from '../../auth/auth.service';
import { User } from '../../auth/entities/user.entity';
import { OrgMembership } from '../../auth/entities/membership.entity';
import { RoleAssignment } from '../../auth/entities/role-assignment.entity';
import type { InviteUserDto, UpdateRoleDto } from './dto/users.dto';

/** Veřejný pohled na uživatele (bez password_hash). */
export interface UserView {
  id: string;
  email: string;
  name: string;
  tenantRole: TenantRole;
  status: string;
  createdAt: Date;
}

function toView(u: User): UserView {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    tenantRole: u.tenantRole,
    status: u.status,
    createdAt: u.createdAt,
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
      role: TenantRole;
      status: string;
      created_at: Date;
    }>;
    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      tenantRole: r.role,
      status: r.status,
      createdAt: r.created_at,
    }));
  }

  async invite(dto: InviteUserDto): Promise<{ user: UserView; tempPassword: string }> {
    const existing = await this.repo().findOne({ where: { email: dto.email } });
    if (existing) throw new BadRequestException('Uživatel s tímto e-mailem už existuje');

    const tempPassword = randomBytes(9).toString('base64url');
    const passwordHash = await AuthService.hashPassword(tempPassword);
    const user = await this.repo().save(
      this.repo().create({
        tenantId: this.context.tenantId,
        email: dto.email,
        name: dto.name,
        passwordHash,
        tenantRole: dto.tenantRole,
        status: 'active',
      }),
    );
    // EPIC-18: členství + role_assignment v aktuální organizaci.
    await this.ensureMembership(user.id, dto.tenantRole);
    await this.audit.record({
      action: 'member.invited',
      targetType: 'user',
      targetId: user.id,
      after: { email: user.email, role: dto.tenantRole },
    });
    return { user: toView(user), tempPassword };
  }

  /** Založí (nebo srovná roli) membershipu identity v aktuální organizaci. */
  private async ensureMembership(userId: string, role: TenantRole): Promise<void> {
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

  async updateRole(id: string, dto: UpdateRoleDto): Promise<UserView> {
    const user = await this.get(id);
    const prevRole = user.tenantRole;
    user.tenantRole = dto.tenantRole;
    const saved = await this.repo().save(user);
    // Srovnej roli v membershipu/role_assignmentu (JWT čte roli z membershipu).
    await this.ensureMembership(user.id, dto.tenantRole);
    await this.audit.record({
      action: 'member.role_changed',
      targetType: 'user',
      targetId: user.id,
      before: { role: prevRole },
      after: { role: dto.tenantRole },
    });
    return toView(saved);
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
