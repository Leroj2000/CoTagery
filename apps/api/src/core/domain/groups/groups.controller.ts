import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, type RequestUser } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators';
import { PermissionsGuard } from '../../rbac/permissions.guard';
import { GroupsService } from './groups.service';
import { CreateGroupDto, AddGroupMemberDto } from './dto/groups.dto';
import type { Group } from '../entities/group.entity';
import type { GroupMember } from '../entities/group-member.entity';

/**
 * Skupiny (EPIC-03) – uživatelů i osob. Čtení VIEWER+. Zápis se gatuje v service
 * podle typu skupiny (`core.group.manage` pro `user`, `core.person_group.manage`
 * pro `person`), protože jeden endpoint obsluhuje oba typy.
 */
@Controller('groups')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Get()
  list(): Promise<Group[]> {
    return this.groups.list();
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateGroupDto): Promise<Group> {
    return this.groups.create(user, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.groups.remove(user, id);
  }

  @Get(':id/members')
  listMembers(@Param('id', ParseUUIDPipe) id: string): Promise<GroupMember[]> {
    return this.groups.listMembers(id);
  }

  @Post(':id/members')
  addMember(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddGroupMemberDto,
  ): Promise<GroupMember> {
    return this.groups.addMember(user, id, dto);
  }

  @Delete(':id/members/:memberRef')
  @HttpCode(204)
  removeMember(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberRef', ParseUUIDPipe) memberRef: string,
  ): Promise<void> {
    return this.groups.removeMember(user, id, memberRef);
  }
}
