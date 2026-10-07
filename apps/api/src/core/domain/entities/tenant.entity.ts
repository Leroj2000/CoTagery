import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Tenant = firma/organizace. Není tenant-scoped (je to sám tenant). */
@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  /** Veřejný slug pro URL storefrontu půjčovny (EPIC-19). */
  @Column({ type: 'text', nullable: true })
  slug!: string | null;

  @Column({ type: 'text', default: 'mixed' })
  type!: 'retail' | 'event' | 'rental' | 'home' | 'mixed';

  @Column({ type: 'text', name: 'branding_domain', nullable: true })
  brandingDomain!: string | null;

  @Column({ type: 'jsonb', name: 'settings_json', default: {} })
  settings!: Record<string, unknown>;

  /**
   * Klíč loga firmy v úložišti (PNG). `select: false` – interní klíč se neposílá
   * v `GET /tenant`; klient dostává jen `hasLogo` a obrázek přes `/tenant/logo`.
   */
  @Column({ type: 'text', name: 'logo_file_key', nullable: true, select: false })
  logoFileKey?: string | null;

  /** Opt-in viditelnost firmy v síti/discovery nad půjčovnou (EPIC-21). */
  @Column({ type: 'boolean', name: 'network_listed', default: false })
  networkListed!: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
