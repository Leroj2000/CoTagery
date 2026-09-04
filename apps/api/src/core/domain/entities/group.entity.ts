import { Column, Entity } from 'typeorm';
import { BaseTenantEntity } from '../../database/base-tenant.entity';

/** Typ skupiny: členové jsou uživatelské účty firmy nebo Osoby (Party). */
export type GroupType = 'user' | 'person';

/** Skupina v rámci tenantu (uživatelů nebo osob). Tenant-scoped → chráněno RLS. */
@Entity('groups')
export class Group extends BaseTenantEntity {
  @Column({ type: 'text' })
  name!: string;

  /** Typ skupiny – určuje, zda členové odkazují na uživatele nebo na osoby. */
  @Column({ type: 'text', default: 'user' })
  type!: GroupType;
}
