import { Column, Entity } from 'typeorm';
import { BaseTenantEntity } from '../../../core/database/base-tenant.entity';

/** Nahraný soubor v galerii (EPIC-11). Binárka žije ve StoragePort (R2/local). */
@Entity('upload_items')
export class UploadItem extends BaseTenantEntity {
  @Column({ type: 'uuid', name: 'gallery_event_id' })
  galleryEventId!: string;

  @Column({ type: 'text', name: 'file_key' })
  fileKey!: string;

  @Column({ type: 'text', name: 'mime_type', nullable: true })
  mimeType!: string | null;

  @Column({ type: 'int', name: 'size_bytes', default: 0 })
  sizeBytes!: number;

  @Column({ type: 'text', default: 'pending' })
  status!: 'pending' | 'approved' | 'rejected';
}
