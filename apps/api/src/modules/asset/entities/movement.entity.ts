import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { HolderType, MovementType } from '../movement.logic';

/**
 * Movement – append-only ledger pohybů assetu (Fáze A). Nedotknutelný audit:
 * událost se NEEDITUJE, oprava = nový pohyb (dokument §7, §23). Nedědí
 * BaseTenantEntity (nemá `updated_at` – je immutable), ale nese `tenant_id`
 * kvůli RLS.
 */
@Entity('asset_movements')
export class Movement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Index()
  @Column({ type: 'uuid', name: 'asset_id' })
  assetId!: string;

  @Column({ type: 'text' })
  type!: MovementType;

  @Column({ type: 'text', name: 'from_type', nullable: true })
  fromType!: HolderType | null;

  @Column({ type: 'uuid', name: 'from_id', nullable: true })
  fromId!: string | null;

  @Column({ type: 'text', name: 'to_type', nullable: true })
  toType!: HolderType | null;

  @Column({ type: 'uuid', name: 'to_id', nullable: true })
  toId!: string | null;

  /** Kdo pohyb provedl (odpovědná/jednající osoba). */
  @Column({ type: 'uuid', name: 'actor_person_id', nullable: true })
  actorPersonId!: string | null;

  @Column({ type: 'timestamptz', name: 'due_at', nullable: true })
  dueAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  /** Potvrzení převzetí příjemcem (§8): none = nevyžaduje, pending → confirmed. */
  @Column({ type: 'text', default: 'none' })
  confirmation!: 'none' | 'pending' | 'confirmed';

  @Column({ type: 'timestamptz', name: 'confirmed_at', nullable: true })
  confirmedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
