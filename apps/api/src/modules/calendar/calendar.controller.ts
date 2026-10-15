import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  CalendarEventDto,
  CalendarItem,
  CalendarShareDto,
  CalendarSource,
  PublicCalendar,
} from '@tagery/shared';
import { CurrentUser } from '../../core/auth/decorators';
import { JwtAuthGuard, type RequestUser } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/rbac/permissions.guard';
import { RequirePermission } from '../../core/rbac/require-permission.decorator';
import { CalendarService } from './calendar.service';
import {
  CalendarRangeQuery,
  CreateCalendarEventDto,
  CreateCalendarShareDto,
  UpdateCalendarEventDto,
} from './dto/calendar.dto';

/** Kalendář firmy – skládaný přehled termínů + ručně založené události. */
@Controller('calendar')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get()
  @RequirePermission('core.calendar.view')
  list(
    @CurrentUser() user: RequestUser,
    @Query() range: CalendarRangeQuery,
    @Query('sources') sources?: string,
  ): Promise<{ sources: CalendarSource[]; items: CalendarItem[] }> {
    return this.calendar.listForUser(
      user,
      range.from,
      range.to,
      sources ? sources.split(',').map((s) => s.trim()) : undefined,
    );
  }

  @Get('events')
  @RequirePermission('core.calendar.view')
  events(@Query() range: CalendarRangeQuery): Promise<CalendarEventDto[]> {
    return this.calendar.listEvents(range.from, range.to);
  }

  @Post('events')
  @RequirePermission('core.calendar.create')
  createEvent(@Body() dto: CreateCalendarEventDto): Promise<CalendarEventDto> {
    return this.calendar.createEvent(dto);
  }

  @Patch('events/:id')
  @RequirePermission('core.calendar.update')
  updateEvent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCalendarEventDto,
  ): Promise<CalendarEventDto> {
    return this.calendar.updateEvent(id, dto);
  }

  @Delete('events/:id')
  @HttpCode(204)
  @RequirePermission('core.calendar.delete')
  deleteEvent(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.calendar.deleteEvent(id);
  }

  @Get('shares')
  @RequirePermission('core.calendar.manage')
  shares(): Promise<CalendarShareDto[]> {
    return this.calendar.listShares();
  }

  @Post('shares')
  @RequirePermission('core.calendar.manage')
  createShare(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateCalendarShareDto,
  ): Promise<{ share: CalendarShareDto; token: string }> {
    return this.calendar.createShare(user, dto);
  }

  @Post('shares/:id/revoke')
  @RequirePermission('core.calendar.manage')
  revokeShare(@Param('id', ParseUUIDPipe) id: string): Promise<CalendarShareDto> {
    return this.calendar.revokeShare(id);
  }
}

/**
 * Veřejný sdílený kalendář (bez JWT, jen čtení) – `/api/v1/public/calendar/:token`.
 * Vrací výhradně položky kalendáře; neplatný/zneplatněný/expirovaný odkaz = 404.
 */
@Controller('public/calendar')
export class PublicCalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get(':token')
  @Header('Cache-Control', 'no-store')
  @Header('X-Robots-Tag', 'noindex')
  view(
    @Param('token') token: string,
    @Query() range: CalendarRangeQuery,
    @Ip() ip: string,
  ): Promise<PublicCalendar> {
    return this.calendar.publicCalendar(token, ip, range.from, range.to);
  }

  @Get(':token/ics')
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  @Header('Content-Disposition', 'inline; filename="kalendar.ics"')
  @Header('Cache-Control', 'no-store')
  @Header('X-Robots-Tag', 'noindex')
  ics(@Param('token') token: string, @Ip() ip: string): Promise<string> {
    return this.calendar.publicIcs(token, ip);
  }
}
