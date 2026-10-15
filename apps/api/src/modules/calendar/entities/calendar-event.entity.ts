import { Column, Entity, Index } from 'typeorm';
import { BaseTenantEntity } from '../../../core/database/base-tenant.entity';

/** Ručně založená událost kalendáře firmy (porada, akce, termín). */
@Entity('calendar_events')
@Index(['tenantId', 'startsAt'])
export class CalendarEvent extends BaseTenantEntity {
  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'text', nullable: true })
  location!: string | null;

  @Column({ type: 'timestamptz', name: 'starts_at' })
  startsAt!: Date;

  @Column({ type: 'timestamptz', name: 'ends_at', nullable: true })
  endsAt!: Date | null;

  @Column({ type: 'boolean', name: 'all_day', default: false })
  allDay!: boolean;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy!: string | null;
}
