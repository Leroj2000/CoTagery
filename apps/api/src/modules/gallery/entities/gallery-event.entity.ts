import { Column, Entity, Index } from 'typeorm';
import { BaseTenantEntity } from '../../../core/database/base-tenant.entity';

/** Sdílená galerie z akce (EPIC-11). Volitelně navázaná na DigitalObject. */
@Entity('gallery_events')
export class GalleryEvent extends BaseTenantEntity {
  @Index({ unique: true, where: '"digital_object_id" IS NOT NULL' })
  @Column({ type: 'uuid', name: 'digital_object_id', nullable: true })
  digitalObjectId!: string | null;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'timestamptz', name: 'event_date', nullable: true })
  eventDate!: Date | null;

  @Column({ type: 'int', name: 'delete_after_days', nullable: true })
  deleteAfterDays!: number | null;

  @Column({ type: 'boolean', name: 'is_private', default: false })
  isPrivate!: boolean;
}
