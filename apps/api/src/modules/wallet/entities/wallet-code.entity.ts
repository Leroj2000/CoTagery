import { Column, Entity } from 'typeorm';
import { BaseTenantEntity } from '../../../core/database/base-tenant.entity';

export type WalletKind = 'discount' | 'access';
export type WalletFormat = 'qr' | 'barcode' | 'nfc';

/**
 * Kód v klíčence. `userId` NULL = celofiremní kód sdílený všem uživatelům;
 * jinak osobní kód konkrétního uživatele (EPIC-18 identita napříč orgy).
 */
@Entity('wallet_codes')
export class WalletCode extends BaseTenantEntity {
  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId!: string | null;

  @Column({ type: 'text' })
  label!: string;

  @Column({ type: 'text' })
  kind!: WalletKind;

  @Column({ type: 'text' })
  format!: WalletFormat;

  @Column({ type: 'text' })
  value!: string;

  @Column({ type: 'text', nullable: true })
  note!: string | null;
}
