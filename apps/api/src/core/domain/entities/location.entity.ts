import { Column, Entity } from 'typeorm';
import { BaseTenantEntity } from '../../database/base-tenant.entity';

/** Lokace tenantu (obchod, sklad, kancelář…). Tenant-scoped → chráněno RLS. */
@Entity('locations')
export class Location extends BaseTenantEntity {
  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', default: 'store' })
  type!:
    | 'city'
    | 'street'
    | 'building'
    | 'room'
    | 'box'
    | 'shelf'
    | 'store'
    | 'venue'
    | 'warehouse'
    | 'office'
    | 'home'
    | 'rack'
    | 'cabinet'
    | 'cell';

  @Column({ type: 'text', nullable: true })
  address!: string | null;

  @Column({ type: 'text', default: 'Europe/Prague' })
  timezone!: string;

  /** Nadřazená lokace – stromová hierarchie (Firma → Sklad → Regál → Police). */
  @Column({ type: 'uuid', name: 'parent_id', nullable: true })
  parentId!: string | null;

  /** Rozdělení regálu/skříně na mřížku (řady × sloupce). Null = bez mřížky. */
  @Column({ type: 'integer', name: 'grid_rows', nullable: true })
  gridRows!: number | null;

  @Column({ type: 'integer', name: 'grid_cols', nullable: true })
  gridCols!: number | null;

  /** Souřadnice buňky uvnitř rodiče (1-based). Null u nemřížkových lokací. */
  @Column({ type: 'integer', name: 'cell_row', nullable: true })
  cellRow!: number | null;

  @Column({ type: 'integer', name: 'cell_col', nullable: true })
  cellCol!: number | null;
}
