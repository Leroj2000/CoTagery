import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MembershipTier } from '../membership/entities/membership-tier.entity';
import { MembershipBenefit } from '../membership/entities/membership-benefit.entity';
import { WalletCode } from './entities/wallet-code.entity';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';

/**
 * Klíčenka – osobní i celofiremní slevové/přístupové kódy (QR / čárový kód /
 * NFC) + agregace existujících kódů z modulů (membership benefity, read-only).
 */
@Module({
  imports: [TypeOrmModule.forFeature([WalletCode, MembershipTier, MembershipBenefit])],
  controllers: [WalletController],
  providers: [WalletService],
})
export class WalletModule {}
