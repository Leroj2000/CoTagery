import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Role = pojmenovaný balíček permissions (EPIC-18 Fáze 1). `tenant_id` NULL =
 * systémová šablona (viditelná všem); jinak vlastní role tenanta. App nesmí
 * záviset na názvu/klíči konkrétní role – rozhoduje se podle permissions v ní.
 */
@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id', nullable: true })
  tenantId!: string | null;

  @Column({ type: 'text' })
  key!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'boolean', name: 'system_flag', default: false })
  systemFlag!: boolean;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
