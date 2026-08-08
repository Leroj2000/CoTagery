import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Log skenů/tapů (analytika, bezpečnost). Zapisuje resolver přes SECURITY DEFINER. */
@Entity('scan_events')
export class ScanEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'uuid', name: 'digital_object_id', nullable: true })
  digitalObjectId!: string | null;

  @Column({ type: 'uuid', name: 'data_carrier_id', nullable: true })
  dataCarrierId!: string | null;

  @Column({ type: 'text', name: 'carrier_type', nullable: true })
  carrierType!: string | null;

  @Column({ type: 'text', name: 'event_type', default: 'scan' })
  eventType!: string;

  @Column({ type: 'text', name: 'ip_address', nullable: true })
  ipAddress!: string | null;

  @Column({ type: 'text', name: 'user_agent', nullable: true })
  userAgent!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
