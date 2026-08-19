import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Entitlement modulu pro organizaci (EPIC-18 Fáze 3). Opt-out: chybí řádek = aktivní. */
@Entity('organization_modules')
@Index(['tenantId', 'moduleKey'], { unique: true })
export class OrganizationModule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'text', name: 'module_key' })
  moduleKey!: string;

  @Column({ type: 'text', default: 'active' })
  state!: 'active' | 'inactive';

  @Column({ type: 'jsonb', name: 'limits_json', nullable: true })
  limitsJson!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
