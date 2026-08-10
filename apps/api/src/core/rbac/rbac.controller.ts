import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { ObjectPermissionLevel } from '@tagery/shared';
import { JwtAuthGuard, type RequestUser } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators';
import { AclService } from './acl.service';
import { RolesGuard, RequireRole } from './roles.guard';
import { GrantPermissionDto } from './dto/grant-permission.dto';
import type { ObjectPermission } from './entities/object-permission.entity';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class RbacController {
  constructor(private readonly acl: AclService) {}

  @Get('objects/:id/permissions')
  list(@Param('id', ParseUUIDPipe) id: string): Promise<ObjectPermission[]> {
    return this.acl.list(id);
  }

  @Post('objects/:id/permissions')
  @RequireRole('ADMIN')
  grant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GrantPermissionDto,
  ): Promise<ObjectPermission> {
    return this.acl.grant(id, dto);
  }

  @Delete('permissions/:permId')
  @RequireRole('ADMIN')
  @HttpCode(204)
  revoke(@Param('permId', ParseUUIDPipe) permId: string): Promise<void> {
    return this.acl.revoke(permId);
  }

  /** Ověří, zda aktuální uživatel má na objektu dané oprávnění. */
  @Get('objects/:id/access-check')
  async accessCheck(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('permission') permission: ObjectPermissionLevel,
    @CurrentUser() user: RequestUser,
  ): Promise<{ allowed: boolean; permission: ObjectPermissionLevel }> {
    const allowed = await this.acl.check(id, user, permission ?? 'view');
    return { allowed, permission: permission ?? 'view' };
  }
}
