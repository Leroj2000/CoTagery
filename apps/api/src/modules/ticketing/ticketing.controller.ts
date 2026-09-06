import { Body, Controller, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/rbac/permissions.guard';
import { RequirePermission } from '../../core/rbac/require-permission.decorator';
import { RequireModule } from '../../core/rbac/require-module.decorator';
import { TicketingService } from './ticketing.service';
import { CreateEventDto, CreateTicketTypeDto, IssueTicketDto } from './dto/ticketing.dto';
import type { Event } from './entities/event.entity';
import type { TicketType } from './entities/ticket-type.entity';
import type { Ticket } from './entities/ticket.entity';

@Controller('ticketing')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequireModule('ticketing')
export class TicketingController {
  constructor(private readonly ticketing: TicketingService) {}

  @Post('events')
  @RequirePermission('ticketing.event.manage')
  createEvent(@Body() dto: CreateEventDto): Promise<Event> {
    return this.ticketing.createEvent(dto);
  }

  @Post('events/:eventId/ticket-types')
  @RequirePermission('ticketing.event.manage')
  createTicketType(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: CreateTicketTypeDto,
  ): Promise<TicketType> {
    return this.ticketing.createTicketType(eventId, dto);
  }

  @Post('ticket-types/:ticketTypeId/tickets')
  @RequirePermission('ticketing.event.manage')
  issueTicket(
    @Param('ticketTypeId', ParseUUIDPipe) ticketTypeId: string,
    @Body() dto: IssueTicketDto,
  ): Promise<Ticket> {
    return this.ticketing.issueTicket(ticketTypeId, dto);
  }
}
