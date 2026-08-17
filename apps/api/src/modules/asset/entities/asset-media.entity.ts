import { Column, Entity, Index } from 'typeorm';
import { BaseTenantEntity } from '../../../core/database/base-tenant.entity';

/**
 * Médium v časové ose věci (návrh docs/navrh-media-timeline.md). Fotka není
 * vlastnost věci, ale událost v jejím životě: časově orazítkovaná, nedotknutelná
 * (mazání = skrytí), volitelně navázaná na pohyb (loan/return) → vzniká
 * trasovatelnost „jak vypadala při půjčení / vrácení". `sha256` = tamper-evidence.
 */
@Entity('asset_media')
export class AssetMedia extends BaseTenantEntity {
  @Index()
  @Column({ type: 'uuid', name: 'asset_id' })
  assetId!: string;

  /** Pohyb, který médium dokumentuje (null = general). */
  @Column({ type: 'uuid', name: 'movement_id', nullable: true })
  movementId!: string | null;

  /** Sémantická kotva okamžiku. */
  @Column({ type: 'text', default: 'general' })
  phase!: 'at_loan' | 'at_return' | 'at_service' | 'general';

  @Column({ type: 'text', default: 'photo' })
  kind!: 'photo' | 'video' | 'document';

  @Column({ type: 'text', name: 'file_key' })
  fileKey!: string;

  @Column({ type: 'text' })
  mime!: string;

  @Column({ type: 'text', nullable: true })
  caption!: string | null;

  /** Otisk souboru – doklad neupravenosti. */
  @Column({ type: 'text', nullable: true })
  sha256!: string | null;

  /** Kdy médium reprezentuje (default = pořízení). */
  @Column({ type: 'timestamptz', name: 'captured_at' })
  capturedAt!: Date;

  @Column({ type: 'uuid', name: 'captured_by', nullable: true })
  capturedBy!: string | null;

  /** „Smazání" = skrytí (audit se nemaže). */
  @Column({ type: 'boolean', default: false })
  hidden!: boolean;
}
