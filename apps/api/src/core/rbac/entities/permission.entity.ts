import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Atomární permission (EPIC-18 Fáze 1) – `namespace.resource.action`. Globální
 * platformní katalog (bez tenant_id). Backend autorizuje podle `key`, ne názvu.
 */
@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', unique: true })
  key!: string;

  @Column({ type: 'text', name: 'module_key' })
  moduleKey!: string;

  @Column({ type: 'text' })
  resource!: string;

  @Column({ type: 'text' })
  action!: string;

  @Column({ type: 'text', default: 'normal' })
  sensitivity!: 'normal' | 'high';

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
