import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type CategorySubject = 'person' | 'user';

/**
 * Zařazení subjektu (osoba/uživatel) do kategorie – many-to-many, tenant-scoped
 * (RLS). Subjekt je person.id nebo user.id (per-firma) dle `subjectType`.
 * Samostatná entita (bez updated_at) – jen append/delete, ne update.
 */
@Entity('category_links')
@Index(['tenantId', 'categoryId', 'subjectType', 'subjectId'], { unique: true })
export class CategoryLink {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'uuid', name: 'category_id' })
  categoryId!: string;

  @Column({ type: 'text', name: 'subject_type' })
  subjectType!: CategorySubject;

  @Column({ type: 'uuid', name: 'subject_id' })
  subjectId!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
