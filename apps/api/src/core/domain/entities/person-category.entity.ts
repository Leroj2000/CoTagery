import { Column, Entity, Index } from 'typeorm';
import { BaseTenantEntity } from '../../database/base-tenant.entity';

/** Kategorie osob (číselník). Tenant-scoped, RLS. Název unikátní v tenantu. */
@Entity('person_categories')
@Index(['tenantId', 'name'], { unique: true })
export class PersonCategory extends BaseTenantEntity {
  @Column({ type: 'text' })
  name!: string;

  /** Volitelná barva (hex) pro odlišení v UI. */
  @Column({ type: 'text', nullable: true })
  color!: string | null;
}
