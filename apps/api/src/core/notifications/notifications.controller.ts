import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { NOTIFICATION_BODY_MAX, NOTIFICATION_SUBJECT_MAX } from '@tagery/shared';
import { JwtAuthGuard, type RequestUser } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { AllowAuthenticatedOnly } from '../rbac/require-permission.decorator';
import { NotificationsService, type NotificationsOverview } from './notifications.service';

class UpdateNotificationDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  /** null = výchozí text. */
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(NOTIFICATION_SUBJECT_MAX)
  subject?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(NOTIFICATION_BODY_MAX)
  body?: string | null;
}

class TemplateDto {
  @IsString()
  @MaxLength(NOTIFICATION_SUBJECT_MAX)
  subject!: string;

  @IsString()
  @MaxLength(NOTIFICATION_BODY_MAX)
  body!: string;
}

class ManagerAccessDto {
  @IsBoolean()
  allowed!: boolean;
}

/**
 * Nastavení → Notifikace. Přístup: owner vždy, manager jen s povolením ownera –
 * hlídá NotificationsService (role + nastavení firmy), proto jen autentizace zde.
 */
@Controller('notifications')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  /** Smí přihlášený spravovat notifikace? (pro navigaci) */
  @Get('access')
  @AllowAuthenticatedOnly()
  access(@CurrentUser() user: RequestUser): Promise<{ canManage: boolean; isOwner: boolean }> {
    return this.notifications.access(user);
  }

  @Get()
  @AllowAuthenticatedOnly()
  overview(@CurrentUser() user: RequestUser): Promise<NotificationsOverview> {
    return this.notifications.overview(user);
  }

  @Put('manager-access')
  @AllowAuthenticatedOnly()
  managerAccess(
    @CurrentUser() user: RequestUser,
    @Body() dto: ManagerAccessDto,
  ): Promise<NotificationsOverview> {
    return this.notifications.setManagerAccess(user, dto.allowed);
  }

  @Put(':key')
  @AllowAuthenticatedOnly()
  update(
    @CurrentUser() user: RequestUser,
    @Param('key') key: string,
    @Body() dto: UpdateNotificationDto,
  ): Promise<NotificationsOverview> {
    return this.notifications.update(user, key, dto);
  }

  @Post(':key/preview')
  @AllowAuthenticatedOnly()
  preview(@CurrentUser() user: RequestUser, @Param('key') key: string, @Body() dto: TemplateDto) {
    return this.notifications.preview(user, key, dto.subject, dto.body);
  }

  @Post(':key/test')
  @AllowAuthenticatedOnly()
  test(@CurrentUser() user: RequestUser, @Param('key') key: string, @Body() dto: TemplateDto) {
    return this.notifications.test(user, key, dto.subject, dto.body);
  }
}
