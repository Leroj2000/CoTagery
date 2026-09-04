import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { TenantRole } from '@tagery/shared';

/**
 * Členství identity v organizaci (EPIC-18 Fáze 0). Jeden `user` může mít víc
 * členství (různé organizace, různé role). `tenant_id` = organization_id
 * (držíme název kvůli jednotné RLS). Role zde je efektivní role v dané org
 * (primární); jemnější granty řeší `role_assignments`. Tabulka `org_memberships`
 * (název `memberships` patří klubovému členství, EPIC-16).
 */
@Entity('org_memberships')
@Index(['tenantId', 'userId'], { unique: true })
export class OrgMembership {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Index()
  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'text', default: 'VIEWER' })
  role!: TenantRole;

  @Column({ type: 'text', default: 'active' })
  status!: 'active' | 'suspended';

  /** Kategorie osoby (uživatele) per-firma – číselník person_categories. */
  @Column({ type: 'uuid', name: 'person_category_id', nullable: true })
  personCategoryId!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
