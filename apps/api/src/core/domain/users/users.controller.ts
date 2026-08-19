import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../rbac/permissions.guard';
import { RequirePermission } from '../../rbac/require-permission.decorator';
import { UsersService, type UserView } from './users.service';
import { InviteUserDto, UpdateRoleDto } from './dto/users.dto';

/** Správa uživatelů tenanta (EPIC-03/01). Náhled=Manager+, správa=Admin+. */
@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermission('core.member.view')
  list(): Promise<UserView[]> {
    return this.users.listViews();
  }

  @Post()
  @RequirePermission('core.member.invite')
  invite(@Body() dto: InviteUserDto): Promise<{ user: UserView; tempPassword: string }> {
    return this.users.invite(dto);
  }

  @Patch(':id/role')
  @RequirePermission('core.role.manage')
  updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<UserView> {
    return this.users.updateRole(id, dto);
  }

  @Post(':id/suspend')
  @RequirePermission('core.member.deactivate')
  suspend(@Param('id', ParseUUIDPipe) id: string): Promise<UserView> {
    return this.users.setStatus(id, 'suspended');
  }

  @Post(':id/activate')
  @RequirePermission('core.member.deactivate')
  activate(@Param('id', ParseUUIDPipe) id: string): Promise<UserView> {
    return this.users.setStatus(id, 'active');
  }
}
