import { Column, Entity, Index } from 'typeorm';
import { BaseTenantEntity } from '../../../core/database/base-tenant.entity';

export type AssetDocumentType = 'invoice' | 'warranty' | 'other';

/**
 * Doklad k pořízení (faktura, záruční list…). Odděleně od časové galerie:
 * faktura nese cenu, proto ji smí stáhnout jen `asset.purchase.view`; záruční
 * list i ten, kdo položku jen vidí (technik u reklamace). Mazání = skrytí.
 */
@Entity('asset_documents')
export class AssetDocument extends BaseTenantEntity {
  @Index()
  @Column({ type: 'uuid', name: 'asset_id' })
  assetId!: string;

  @Column({ type: 'text', name: 'doc_type' })
  docType!: AssetDocumentType;

  @Column({ type: 'text', name: 'file_name', nullable: true })
  fileName!: string | null;

  @Column({ type: 'text', name: 'file_key', select: false })
  fileKey!: string;

  @Column({ type: 'text' })
  mime!: string;

  @Column({ type: 'bigint', name: 'size_bytes', nullable: true })
  sizeBytes!: number | null;

  @Column({ type: 'text', nullable: true })
  sha256!: string | null;

  @Column({ type: 'uuid', name: 'uploaded_by', nullable: true })
  uploadedBy!: string | null;

  @Column({ type: 'boolean', default: false })
  hidden!: boolean;
}
