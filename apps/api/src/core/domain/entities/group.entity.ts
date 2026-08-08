import { Column, Entity } from 'typeorm';
import { BaseTenantEntity } from '../../database/base-tenant.entity';

/** Skupina uživatelů v rámci tenantu. Tenant-scoped → chráněno RLS. */
@Entity('groups')
export class Group extends BaseTenantEntity {
  @Column({ type: 'text' })
  name!: string;
}
