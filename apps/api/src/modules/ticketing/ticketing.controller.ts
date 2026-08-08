import { Body, Controller, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { TicketingService } from './ticketing.service';
import { CreateEventDto, CreateTicketTypeDto, IssueTicketDto } from './dto/ticketing.dto';
import type { Event } from './entities/event.entity';
import type { TicketType } from './entities/ticket-type.entity';
import type { Ticket } from './entities/ticket.entity';

@Controller('ticketing')
@UseGuards(JwtAuthGuard)
export class TicketingController {
  constructor(private readonly ticketing: TicketingService) {}

  @Post('events')
  createEvent(@Body() dto: CreateEventDto): Promise<Event> {
    return this.ticketing.createEvent(dto);
  }

  @Post('events/:eventId/ticket-types')
  createTicketType(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: CreateTicketTypeDto,
  ): Promise<TicketType> {
    return this.ticketing.createTicketType(eventId, dto);
  }

  @Post('ticket-types/:ticketTypeId/tickets')
  issueTicket(
    @Param('ticketTypeId', ParseUUIDPipe) ticketTypeId: string,
    @Body() dto: IssueTicketDto,
  ): Promise<Ticket> {
    return this.ticketing.issueTicket(ticketTypeId, dto);
  }
}
