import { Column, Entity, Index } from 'typeorm';
import { BaseTenantEntity } from '../../../core/database/base-tenant.entity';

/**
 * Manuál / návod k položce (asset). Na rozdíl od fotogalerie a časové osy jde
 * o dokumentaci k obsluze věci. Zdroj může být upload souboru, fotka z kamery,
 * nebo automatické stažení „přes AI" (webhook do n8n → callback). Dokud AI
 * stahuje, řádek existuje se `status='fetching'` a `file_key=null`.
 */
@Entity('asset_manuals')
export class AssetManual extends BaseTenantEntity {
  @Index()
  @Column({ type: 'uuid', name: 'asset_id' })
  assetId!: string;

  @Column({ type: 'text' })
  title!: string;

  /** Klíč souboru v úložišti. Null dokud AI stahuje (status='fetching'). */
  @Column({ type: 'text', name: 'file_key', nullable: true })
  fileKey!: string | null;

  @Column({ type: 'text', nullable: true })
  mime!: string | null;

  @Column({ type: 'bigint', name: 'size_bytes', nullable: true })
  sizeBytes!: number | null;

  /** Jak manuál vznikl. */
  @Column({ type: 'text', default: 'upload' })
  source!: 'upload' | 'camera' | 'ai';

  /** Odkud AI manuál stáhla (oficiální PDF apod.). */
  @Column({ type: 'text', name: 'source_url', nullable: true })
  sourceUrl!: string | null;

  /** Stav: připraveno / probíhá AI stahování / selhalo. */
  @Column({ type: 'text', default: 'ready' })
  status!: 'ready' | 'fetching' | 'failed';

  /** Srozumitelný důvod selhání (např. málo detailů o položce, vypršel čas). */
  @Column({ type: 'text', name: 'failure_reason', nullable: true })
  failureReason!: string | null;
}
