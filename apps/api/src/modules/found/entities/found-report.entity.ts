import { Column, Entity, Index } from 'typeorm';
import { BaseTenantEntity } from '../../../core/database/base-tenant.entity';

/**
 * Nahlášení nálezu (§33) – nálezce naskenuje veřejný QR bez loginu a anonymně
 * pošle zprávu vlastníkovi. Neodhaluje interní údaje. Vlastník dostane záznam
 * a může kontaktovat nálezce, pokud kontakt uvedl.
 */
@Entity('found_reports')
export class FoundReport extends BaseTenantEntity {
  /** Veřejný kód naskenovaného nosiče. */
  @Index()
  @Column({ type: 'text', name: 'public_code' })
  publicCode!: string;

  @Column({ type: 'uuid', name: 'digital_object_id', nullable: true })
  digitalObjectId!: string | null;

  @Column({ type: 'text' })
  message!: string;

  /** Volitelný kontakt na nálezce (telefon/e-mail) – dobrovolný. */
  @Column({ type: 'text', name: 'finder_contact', nullable: true })
  finderContact!: string | null;

  @Column({ type: 'text', default: 'new' })
  status!: 'new' | 'handled';
}
