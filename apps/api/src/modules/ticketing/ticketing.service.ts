import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantContextService } from '../../core/tenancy/tenant-context.service';
import { Event } from './entities/event.entity';
import { TicketType } from './entities/ticket-type.entity';
import { Ticket } from './entities/ticket.entity';
import type { CreateEventDto, CreateTicketTypeDto, IssueTicketDto } from './dto/ticketing.dto';

@Injectable()
export class TicketingService {
  constructor(private readonly context: TenantContextService) {}

  createEvent(dto: CreateEventDto): Promise<Event> {
    const repo = this.context.manager.getRepository(Event);
    return repo.save(
      repo.create({
        tenantId: this.context.tenantId,
        name: dto.name,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
      }),
    );
  }

  async createTicketType(eventId: string, dto: CreateTicketTypeDto): Promise<TicketType> {
    const event = await this.context.manager.getRepository(Event).findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Akce neexistuje');
    const repo = this.context.manager.getRepository(TicketType);
    return repo.save(
      repo.create({
        tenantId: this.context.tenantId,
        eventId,
        name: dto.name,
        price: dto.price ?? '0',
        quantity: dto.quantity ?? 0,
      }),
    );
  }

  async issueTicket(ticketTypeId: string, dto: IssueTicketDto): Promise<Ticket> {
    const type = await this.context.manager
      .getRepository(TicketType)
      .findOne({ where: { id: ticketTypeId } });
    if (!type) throw new NotFoundException('Typ vstupenky neexistuje');
    const repo = this.context.manager.getRepository(Ticket);
    return repo.save(
      repo.create({
        tenantId: this.context.tenantId,
        eventId: type.eventId,
        ticketTypeId,
        buyerName: dto.buyerName ?? null,
        status: 'paid',
      }),
    );
  }
}
