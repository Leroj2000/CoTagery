import { Column, Entity } from 'typeorm';
import { BaseTenantEntity } from '../../../core/database/base-tenant.entity';

@Entity('ticket_types')
export class TicketType extends BaseTenantEntity {
  @Column({ type: 'uuid', name: 'event_id' })
  eventId!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'numeric', default: 0 })
  price!: string;

  @Column({ type: 'int', default: 0 })
  quantity!: number;
}
