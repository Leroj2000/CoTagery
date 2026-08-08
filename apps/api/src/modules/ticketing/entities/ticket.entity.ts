import { Column, Entity } from 'typeorm';
import { BaseTenantEntity } from '../../../core/database/base-tenant.entity';

@Entity('tickets')
export class Ticket extends BaseTenantEntity {
  @Column({ type: 'uuid', name: 'event_id' })
  eventId!: string;

  @Column({ type: 'uuid', name: 'ticket_type_id' })
  ticketTypeId!: string;

  @Column({ type: 'text', name: 'buyer_name', nullable: true })
  buyerName!: string | null;

  /** pending → paid → redeemed | cancelled (MVP vydává rovnou paid). */
  @Column({ type: 'text', default: 'paid' })
  status!: 'pending' | 'paid' | 'redeemed' | 'cancelled';

  @Column({ type: 'timestamptz', name: 'redeemed_at', nullable: true })
  redeemedAt!: Date | null;
}
