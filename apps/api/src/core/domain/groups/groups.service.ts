import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { AuthzService } from '../../rbac/authz.service';
import type { RequestUser } from '../../auth/jwt-auth.guard';
import { Group, type GroupType } from '../entities/group.entity';
import { GroupMember } from '../entities/group-member.entity';
import type { CreateGroupDto, AddGroupMemberDto } from './dto/groups.dto';

/** Permission key podle typu skupiny. */
function permissionForType(type: GroupType): string {
  return type === 'person' ? 'core.person_group.manage' : 'core.group.manage';
}

/**
 * Skupiny tenanta (EPIC-03). Dva typy: uživatelů (`user`) a osob (`person`).
 * Tenant-scoped přes RLS. Oprávnění se vynucuje podle typu skupiny:
 *  - `user`   → `core.group.manage` (jen ADMIN+),
 *  - `person` → `core.person_group.manage` (ADMIN+ i EDITOR).
 * Gate je v service (ne staticky v controlleru), protože jeden endpoint
 * obsluhuje oba typy – rozhodnutí závisí na `type` skupiny za běhu.
 */
@Injectable()
export class GroupsService {
  constructor(
    private readonly context: TenantContextService,
    private readonly authz: AuthzService,
  ) {}

  private groups(): Repository<Group> {
    return this.context.manager.getRepository(Group);
  }

  private members(): Repository<GroupMember> {
    return this.context.manager.getRepository(GroupMember);
  }

  list(): Promise<Group[]> {
    return this.groups().find({ order: { createdAt: 'DESC' } });
  }

  async create(user: RequestUser, dto: CreateGroupDto): Promise<Group> {
    const type: GroupType = dto.type ?? 'user';
    await this.authz.assert(user, permissionForType(type));
    return this.groups().save(
      this.groups().create({ tenantId: this.context.tenantId, name: dto.name, type }),
    );
  }

  private async getGroup(groupId: string): Promise<Group> {
    const group = await this.groups().findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Skupina neexistuje');
    return group;
  }

  async remove(user: RequestUser, groupId: string): Promise<void> {
    const group = await this.getGroup(groupId);
    await this.authz.assert(user, permissionForType(group.type));
    await this.members().delete({ groupId: group.id });
    await this.groups().remove(group);
  }

  listMembers(groupId: string): Promise<GroupMember[]> {
    return this.members().find({ where: { groupId } });
  }

  async addMember(
    user: RequestUser,
    groupId: string,
    dto: AddGroupMemberDto,
  ): Promise<GroupMember> {
    const group = await this.getGroup(groupId);
    await this.authz.assert(user, permissionForType(group.type));

    if (group.type === 'person') {
      if (!dto.personId) throw new BadRequestException('Chybí personId');
      const existing = await this.members().findOne({
        where: { groupId, personId: dto.personId },
      });
      if (existing) return existing;
      return this.members().save(
        this.members().create({
          tenantId: this.context.tenantId,
          groupId,
          personId: dto.personId,
          userId: null,
        }),
      );
    }

    if (!dto.userId) throw new BadRequestException('Chybí userId');
    const existing = await this.members().findOne({
      where: { groupId, userId: dto.userId },
    });
    if (existing) return existing;
    return this.members().save(
      this.members().create({
        tenantId: this.context.tenantId,
        groupId,
        userId: dto.userId,
        personId: null,
      }),
    );
  }

  async removeMember(user: RequestUser, groupId: string, memberRef: string): Promise<void> {
    const group = await this.getGroup(groupId);
    await this.authz.assert(user, permissionForType(group.type));
    if (group.type === 'person') {
      await this.members().delete({ groupId, personId: memberRef });
    } else {
      await this.members().delete({ groupId, userId: memberRef });
    }
  }
}
