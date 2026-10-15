import { Column, Entity } from 'typeorm';
import { BaseTenantEntity } from '../../../core/database/base-tenant.entity';

/**
 * Veřejný odkaz na kalendář (jen pro čtení). Token se ukládá jen jako SHA-256
 * hash – po založení ho nejde znovu zobrazit, jen zneplatnit a vytvořit nový.
 */
@Entity('calendar_shares')
export class CalendarShare extends BaseTenantEntity {
  @Column({ type: 'text', name: 'token_hash', select: false })
  tokenHash!: string;

  @Column({ type: 'text', nullable: true })
  label!: string | null;

  @Column({ type: 'text', array: true, default: () => "'{event}'" })
  sources!: string[];

  @Column({ type: 'timestamptz', name: 'expires_at', nullable: true })
  expiresAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'revoked_at', nullable: true })
  revokedAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'last_accessed_at', nullable: true })
  lastAccessedAt!: Date | null;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy!: string | null;
}
