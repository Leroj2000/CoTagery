import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Log doručení webhooku (pro ladění). Append-only. */
@Entity('webhook_deliveries')
export class WebhookDelivery {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Index()
  @Column({ type: 'uuid', name: 'endpoint_id' })
  endpointId!: string;

  @Column({ type: 'text' })
  event!: string;

  @Column({ type: 'int', name: 'status_code', nullable: true })
  statusCode!: number | null;

  @Column({ type: 'boolean', default: false })
  ok!: boolean;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
