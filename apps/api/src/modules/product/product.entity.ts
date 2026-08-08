import { Column, Entity, Index } from 'typeorm';
import { BaseTenantEntity } from '../../core/database/base-tenant.entity';

/** Product modul (EPIC-08): produktová karta navázaná na DigitalObject. */
@Entity('products')
export class Product extends BaseTenantEntity {
  @Index({ unique: true })
  @Column({ type: 'uuid', name: 'digital_object_id' })
  digitalObjectId!: string;

  @Column({ type: 'text', nullable: true })
  gtin!: string | null;

  @Column({ type: 'text', nullable: true })
  brand!: string | null;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'text', nullable: true })
  ingredients!: string | null;

  @Column({ type: 'text', nullable: true })
  origin!: string | null;

  @Column({ type: 'text', name: 'care_instructions', nullable: true })
  careInstructions!: string | null;

  @Column({ type: 'jsonb', default: [] })
  media!: unknown[];
}
