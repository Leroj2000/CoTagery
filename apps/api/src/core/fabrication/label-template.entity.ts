import { Column, Entity } from 'typeorm';
import type { LabelCell } from '@tagery/shared';
import { BaseTenantEntity } from '../database/base-tenant.entity';

/** Uložená šablona štítku pro jeden formát (bez záznamu platí výchozí šablona). */
@Entity('label_templates')
export class LabelTemplateEntity extends BaseTenantEntity {
  @Column({ type: 'text', name: 'format_key' })
  formatKey!: string;

  @Column({ type: 'jsonb', default: [] })
  cells!: LabelCell[];
}
