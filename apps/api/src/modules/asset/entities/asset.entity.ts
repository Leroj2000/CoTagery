import { Column, Entity, Index } from 'typeorm';
import { BaseTenantEntity } from '../../../core/database/base-tenant.entity';
import type { AssetStatus, HolderType } from '../movement.logic';

/**
 * Asset – fyzická věc s digitální identitou (Fáze A). Navázán na `DigitalObject`
 * (nosič = Tag). `status` a `current_holder*` se ODVOZUJÍ z pohybů (Movement),
 * nenastavují se ručně. `home_location` (kam patří) je oddělené od holdera
 * (kde věc je / kdo ji má) – tři různé údaje se nesmí slévat.
 */
@Entity('assets')
export class Asset extends BaseTenantEntity {
  @Index({ unique: true })
  @Column({ type: 'uuid', name: 'digital_object_id' })
  digitalObjectId!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  category!: string | null;

  @Column({ type: 'text', nullable: true })
  manufacturer!: string | null;

  @Column({ type: 'text', nullable: true })
  model!: string | null;

  @Column({ type: 'text', name: 'serial_number', nullable: true })
  serialNumber!: string | null;

  @Column({ type: 'text', name: 'inventory_number', nullable: true })
  inventoryNumber!: string | null;

  /** Kam věc patří (domovská lokace). Oddělené od aktuálního holdera. */
  @Column({ type: 'uuid', name: 'home_location_id', nullable: true })
  homeLocationId!: string | null;

  // --- Odvozený stav (z Movement ledgeru) ---
  @Column({ type: 'text', default: 'available' })
  status!: AssetStatus;

  @Column({ type: 'text', name: 'current_holder_type', nullable: true })
  currentHolderType!: HolderType | null;

  @Column({ type: 'uuid', name: 'current_holder_id', nullable: true })
  currentHolderId!: string | null;

  @Column({ type: 'uuid', name: 'responsible_person_id', nullable: true })
  responsiblePersonId!: string | null;

  /** Předpokládané vrácení (u půjček). */
  @Column({ type: 'timestamptz', name: 'due_at', nullable: true })
  dueAt!: Date | null;
}
