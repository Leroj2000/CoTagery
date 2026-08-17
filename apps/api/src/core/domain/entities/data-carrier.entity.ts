import { Column, Entity, Index } from 'typeorm';
import { BaseTenantEntity } from '../../database/base-tenant.entity';

/** Fyzický nosič (QR / NFC / hybrid). Jeden DigitalObject může mít víc nosičů. */
@Entity('data_carriers')
export class DataCarrier extends BaseTenantEntity {
  /** Null = předgenerovaný nepřiřazený nosič (pool k pozdějšímu claim). */
  @Column({ type: 'uuid', name: 'digital_object_id', nullable: true })
  digitalObjectId!: string | null;

  @Column({ type: 'text', name: 'carrier_type', default: 'qr' })
  carrierType!: 'qr' | 'nfc' | 'hybrid';

  /** Globálně unikátní veřejný kód v URL (resolver). */
  @Index({ unique: true })
  @Column({ type: 'text', name: 'public_code' })
  publicCode!: string;

  @Column({ type: 'text', name: 'resolver_url', nullable: true })
  resolverUrl!: string | null;

  @Column({ type: 'text', name: 'qr_payload', nullable: true })
  qrPayload!: string | null;

  @Column({ type: 'text', name: 'nfc_uid', nullable: true })
  nfcUid!: string | null;

  @Column({ type: 'text', name: 'nfc_payload', nullable: true })
  nfcPayload!: string | null;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ type: 'text', default: 'active' })
  status!: 'unassigned' | 'active' | 'replaced' | 'lost' | 'destroyed';

  // --- Veřejná self-aktivace (PIN varianta) ---
  @Column({ type: 'boolean', name: 'self_activatable', default: false })
  selfActivatable!: boolean;

  @Column({ type: 'text', name: 'activation_pin_hash', nullable: true })
  activationPinHash!: string | null;

  @Column({ type: 'text', name: 'module_template', nullable: true })
  moduleTemplate!: string | null;

  // --- Adopce cizího identifikátoru (alias jen pro interní skener) ---
  /** Externí kód (EAN / URL / vlastní). Rozpozná ho JEN interní skener, ne veřejný resolver. */
  @Index('ix_data_carriers_external_code', { where: '"external_code" IS NOT NULL' })
  @Column({ type: 'text', name: 'external_code', nullable: true })
  externalCode!: string | null;

  @Column({ type: 'text', name: 'external_scheme', nullable: true })
  externalScheme!: 'ean13' | 'url' | 'custom' | null;

  /** Původ carrieru: 'native' (jen náš kód) | 'adopted' (adoptovaný cizí kód + náš). */
  @Column({ type: 'text', default: 'native' })
  origin!: 'native' | 'adopted';
}
