import { Column, Entity, Index } from 'typeorm';
import { BaseTenantEntity } from '../../../core/database/base-tenant.entity';

/**
 * Fyzická/digitální karta členství (EPIC-16), spárovaná s nosičem (DataCarrier
 * QR/NFC). Jedno členství může mít víc kart (náhrada za ztracenou).
 */
@Entity('membership_cards')
export class MembershipCard extends BaseTenantEntity {
  @Index()
  @Column({ type: 'uuid', name: 'membership_id' })
  membershipId!: string;

  /** Nosič, na kterém je karta vytištěná (QR/NFC). */
  @Index({ unique: true })
  @Column({ type: 'uuid', name: 'data_carrier_id' })
  dataCarrierId!: string;

  @Column({ type: 'text', default: 'active' })
  status!: 'active' | 'revoked' | 'lost';
}
