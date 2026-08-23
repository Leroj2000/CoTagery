import { Column, Entity, Index } from 'typeorm';
import { BaseTenantEntity } from '../../../core/database/base-tenant.entity';

/**
 * Fotka v galerii věci (kurátorská, řazená). `position` určuje pořadí; fotka
 * na pozici 0 je hlavní a promítá se do `assets.photo_key`. Na rozdíl od
 * `asset_media` (nedotknutelná timeline) jde o vlastnost věci – lze mazat/řadit.
 */
@Entity('asset_photos')
export class AssetPhoto extends BaseTenantEntity {
  @Index()
  @Column({ type: 'uuid', name: 'asset_id' })
  assetId!: string;

  @Column({ type: 'text', name: 'file_key' })
  fileKey!: string;

  @Column({ type: 'text' })
  mime!: string;

  @Column({ type: 'integer', default: 0 })
  position!: number;
}
