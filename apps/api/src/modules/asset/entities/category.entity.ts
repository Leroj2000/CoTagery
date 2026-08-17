import { Column, Entity, Index } from 'typeorm';
import { BaseTenantEntity } from '../../../core/database/base-tenant.entity';

/** Kategorie věcí (číselník). Tenant-scoped, RLS. Název unikátní v rámci tenantu. */
@Entity('asset_categories')
@Index(['tenantId', 'name'], { unique: true })
export class Category extends BaseTenantEntity {
  @Column({ type: 'text' })
  name!: string;

  /** Volitelná barva (hex) pro odlišení v UI. */
  @Column({ type: 'text', nullable: true })
  color!: string | null;
}
