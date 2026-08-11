import { randomBytes } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import type { TenantRole } from '@tagery/shared';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { AuthService } from '../../auth/auth.service';
import { User } from '../../auth/entities/user.entity';
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
  constructor(private readonly context: TenantContextService) {}

  private repo(): Repository<User> {
    return this.context.manager.getRepository(User);
  }

  async listViews(): Promise<UserView[]> {
    const users = await this.repo().find({ order: { createdAt: 'DESC' }, take: 500 });
    return users.map(toView);
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
    return { user: toView(user), tempPassword };
  }

  async updateRole(id: string, dto: UpdateRoleDto): Promise<UserView> {
    const user = await this.get(id);
    user.tenantRole = dto.tenantRole;
    return toView(await this.repo().save(user));
  }

  async setStatus(id: string, status: 'active' | 'suspended'): Promise<UserView> {
    const user = await this.get(id);
    user.status = status;
    return toView(await this.repo().save(user));
  }

  private async get(id: string): Promise<User> {
    const user = await this.repo().findOne({ where: { id } });
    if (!user) throw new NotFoundException('Uživatel neexistuje');
    return user;
  }
}
