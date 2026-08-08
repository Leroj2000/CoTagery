import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from './entities/event.entity';
import { TicketType } from './entities/ticket-type.entity';
import { Ticket } from './entities/ticket.entity';
import { TicketingService } from './ticketing.service';
import { TicketingController } from './ticketing.controller';
import { TicketEntitlementProvider } from './ticket-entitlement.provider';

/** EPIC-09 Ticketing – vstupenky + check-in přes sdílený Access-Control. */
@Module({
  imports: [TypeOrmModule.forFeature([Event, TicketType, Ticket])],
  controllers: [TicketingController],
  providers: [TicketingService, TicketEntitlementProvider],
})
export class TicketingModule {}
