import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard, RequireRole } from '../../rbac/roles.guard';
import { UsersService, type UserView } from './users.service';
import { InviteUserDto, UpdateRoleDto } from './dto/users.dto';

/** Správa uživatelů tenanta (EPIC-03/01) – jen ADMIN+. */
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequireRole('ADMIN')
  list(): Promise<UserView[]> {
    return this.users.listViews();
  }

  @Post()
  @RequireRole('ADMIN')
  invite(@Body() dto: InviteUserDto): Promise<{ user: UserView; tempPassword: string }> {
    return this.users.invite(dto);
  }

  @Patch(':id/role')
  @RequireRole('ADMIN')
  updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<UserView> {
    return this.users.updateRole(id, dto);
  }

  @Post(':id/suspend')
  @RequireRole('ADMIN')
  suspend(@Param('id', ParseUUIDPipe) id: string): Promise<UserView> {
    return this.users.setStatus(id, 'suspended');
  }

  @Post(':id/activate')
  @RequireRole('ADMIN')
  activate(@Param('id', ParseUUIDPipe) id: string): Promise<UserView> {
    return this.users.setStatus(id, 'active');
  }
}
