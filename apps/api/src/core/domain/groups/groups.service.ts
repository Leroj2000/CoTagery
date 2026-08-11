import { Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { Group } from '../entities/group.entity';
import { GroupMember } from '../entities/group-member.entity';
import type { CreateGroupDto, AddGroupMemberDto } from './dto/groups.dto';

/** Skupiny uživatelů tenanta (EPIC-03). Tenant-scoped přes RLS. */
@Injectable()
export class GroupsService {
  constructor(private readonly context: TenantContextService) {}

  private groups(): Repository<Group> {
    return this.context.manager.getRepository(Group);
  }

  private members(): Repository<GroupMember> {
    return this.context.manager.getRepository(GroupMember);
  }

  list(): Promise<Group[]> {
    return this.groups().find({ order: { createdAt: 'DESC' } });
  }

  create(dto: CreateGroupDto): Promise<Group> {
    return this.groups().save(
      this.groups().create({ tenantId: this.context.tenantId, name: dto.name }),
    );
  }

  private async getGroup(groupId: string): Promise<Group> {
    const group = await this.groups().findOne({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Skupina neexistuje');
    return group;
  }

  async remove(groupId: string): Promise<void> {
    const group = await this.getGroup(groupId);
    await this.members().delete({ groupId: group.id });
    await this.groups().remove(group);
  }

  listMembers(groupId: string): Promise<GroupMember[]> {
    return this.members().find({ where: { groupId } });
  }

  async addMember(groupId: string, dto: AddGroupMemberDto): Promise<GroupMember> {
    await this.getGroup(groupId);
    const existing = await this.members().findOne({
      where: { groupId, userId: dto.userId },
    });
    if (existing) return existing;
    return this.members().save(
      this.members().create({
        tenantId: this.context.tenantId,
        groupId,
        userId: dto.userId,
      }),
    );
  }

  async removeMember(groupId: string, userId: string): Promise<void> {
    await this.members().delete({ groupId, userId });
  }
}
