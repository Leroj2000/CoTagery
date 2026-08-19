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
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../rbac/permissions.guard';
import { RequirePermission } from '../../rbac/require-permission.decorator';
import { GroupsService } from './groups.service';
import { CreateGroupDto, AddGroupMemberDto } from './dto/groups.dto';
import type { Group } from '../entities/group.entity';
import type { GroupMember } from '../entities/group-member.entity';

/** Skupiny uživatelů (EPIC-03) – správa ADMIN+, čtení VIEWER+. */
@Controller('groups')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Get()
  list(): Promise<Group[]> {
    return this.groups.list();
  }

  @Post()
  @RequirePermission('core.group.manage')
  create(@Body() dto: CreateGroupDto): Promise<Group> {
    return this.groups.create(dto);
  }

  @Delete(':id')
  @RequirePermission('core.group.manage')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.groups.remove(id);
  }

  @Get(':id/members')
  listMembers(@Param('id', ParseUUIDPipe) id: string): Promise<GroupMember[]> {
    return this.groups.listMembers(id);
  }

  @Post(':id/members')
  @RequirePermission('core.group.manage')
  addMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddGroupMemberDto,
  ): Promise<GroupMember> {
    return this.groups.addMember(id, dto);
  }

  @Delete(':id/members/:userId')
  @RequirePermission('core.group.manage')
  @HttpCode(204)
  removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<void> {
    return this.groups.removeMember(id, userId);
  }
}
