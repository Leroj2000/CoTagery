import { Column, Entity } from 'typeorm';
import { BaseTenantEntity } from '../../../core/database/base-tenant.entity';

/** Akce (koncert, konference…) – EPIC-09 Ticketing. */
@Entity('events')
export class Event extends BaseTenantEntity {
  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'timestamptz', name: 'starts_at', nullable: true })
  startsAt!: Date | null;

  @Column({ type: 'text', default: 'active' })
  status!: 'active' | 'cancelled' | 'ended';
}
