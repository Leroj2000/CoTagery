import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type AccountActionPurpose = 'verify_email' | 'accept_invite';

@Entity('account_action_tokens')
export class AccountActionToken {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', name: 'user_id' }) userId!: string;
  @Column({ type: 'uuid', name: 'tenant_id' }) tenantId!: string;
  @Column({ type: 'text' }) purpose!: AccountActionPurpose;
  @Column({ type: 'text', name: 'token_hash' }) tokenHash!: string;
  @Column({ type: 'timestamptz', name: 'expires_at' }) expiresAt!: Date;
  @Column({ type: 'timestamptz', name: 'used_at', nullable: true }) usedAt!: Date | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
}
