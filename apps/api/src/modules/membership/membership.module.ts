import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DomainModule } from '../../core/domain/domain.module';
import { Member } from './entities/member.entity';
import { MembershipTier } from './entities/membership-tier.entity';
import { Membership } from './entities/membership.entity';
import { MembershipCard } from './entities/membership-card.entity';
import { MembershipBenefit } from './entities/membership-benefit.entity';
import { MembershipService } from './membership.service';
import { MembershipController } from './membership.controller';
import { MembershipHandler } from './membership.handler';
import { MembershipEntitlementProvider } from './membership-entitlement.provider';

/**
 * EPIC-16 Membership – klubové členství: tiery, platnost, karty (QR/NFC),
 * benefity. Registruje scan handler (DomainModule) i entitlement provider
 * pro vstup do zón (AccessRegistry je globální z AccessControlModule).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Member, MembershipTier, Membership, MembershipCard, MembershipBenefit]),
    DomainModule,
  ],
  controllers: [MembershipController],
  providers: [MembershipService, MembershipHandler, MembershipEntitlementProvider],
  exports: [MembershipService],
})
export class MembershipModule {}
