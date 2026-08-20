import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Konfigurace time_window pravidla. */
export interface TimeWindowConfig {
  days?: number[]; // 1=Po .. 7=Ne (ISO)
  from?: string; // 'HH:MM'
  to?: string; // 'HH:MM'
  tz?: string; // IANA timezone, default org/UTC
}

/** Deklarativní policy (EPIC-18 Fáze 4). MVP typ: 'time_window'. */
@Entity('policies')
export class Policy {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'text' })
  type!: 'time_window';

  @Column({ type: 'jsonb', name: 'config_json', default: {} })
  configJson!: TimeWindowConfig;

  @Column({ type: 'text', default: 'active' })
  status!: 'active' | 'inactive';

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
