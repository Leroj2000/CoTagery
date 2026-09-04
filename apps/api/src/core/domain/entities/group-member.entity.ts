import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Členství ve skupině. Nese tenant_id kvůli RLS. Podle typu skupiny je vyplněn
 * buď `userId` (skupina uživatelů), nebo `personId` (skupina osob) – právě jeden.
 */
@Entity('group_members')
@Index(['groupId', 'userId'], { unique: true, where: 'user_id IS NOT NULL' })
@Index(['groupId', 'personId'], { unique: true, where: 'person_id IS NOT NULL' })
export class GroupMember {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'uuid', name: 'group_id' })
  groupId!: string;

  /** Člen = uživatelský účet (u skupiny typu `user`). */
  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId!: string | null;

  /** Člen = Osoba/Party (u skupiny typu `person`). */
  @Column({ type: 'uuid', name: 'person_id', nullable: true })
  personId!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
