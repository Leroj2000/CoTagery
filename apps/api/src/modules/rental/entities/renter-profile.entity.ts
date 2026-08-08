import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * PLATFORMOVÁ identita nájemce – sdílená napříč tenanty (ADR-0005, Uber/Bolt).
 * BEZ tenant_id a BEZ RLS: reputace i ověření následují osobu přes všechny
 * pronajímatele. Ostatní rental data (Item/Loan) zůstávají tenant-izolovaná.
 */
@Entity('renter_profiles')
export class RenterProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'text' })
  email!: string;

  @Column({ type: 'text', name: 'display_name' })
  displayName!: string;

  @Column({ type: 'text', nullable: true })
  phone!: string | null;

  @Column({ type: 'text', name: 'verification_level', default: 'none' })
  verificationLevel!: 'none' | 'contact' | 'document' | 'full_kyc';

  @Column({ type: 'numeric', name: 'rating_avg', default: 0 })
  ratingAvg!: string;

  @Column({ type: 'int', name: 'rating_count', default: 0 })
  ratingCount!: number;

  @Column({ type: 'text', default: 'active' })
  status!: 'active' | 'blocked';

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
