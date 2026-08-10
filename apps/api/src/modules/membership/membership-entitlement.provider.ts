import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  AccessRegistry,
  type AccessDecision,
  type EntitlementProvider,
} from '../../core/access/entitlement';
import type { AccessPoint } from '../../core/access/entities/access-point.entity';
import { MembershipService } from './membership.service';
import { isMembershipActive } from './membership.logic';

/**
 * Poskytovatel nároku pro subjectType 'membership' (ADR-0006). `subjectRef` je
 * `data_carrier_id` naskenované karty. Pustí do zóny, pokud je členství aktivní
 * a tier opravňuje ke `zone_key` daného access-pointu. Na rozdíl od vstupenky
 * se nárok nespotřebuje (opakovatelný vstup).
 */
@Injectable()
export class MembershipEntitlementProvider implements EntitlementProvider, OnModuleInit {
  readonly subjectType = 'membership';

  constructor(
    private readonly registry: AccessRegistry,
    private readonly memberships: MembershipService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async evaluate(subjectRef: string, accessPoint: AccessPoint): Promise<AccessDecision> {
    let card;
    try {
      card = await this.memberships.cardByCarrier(subjectRef);
    } catch {
      return { decision: 'deny', reason: 'invalid_card', entitlementRef: null };
    }
    if (!card || card.status !== 'active') {
      return { decision: 'deny', reason: 'no_active_card', entitlementRef: null };
    }

    const membership = await this.memberships.getMembership(card.membershipId);
    const tier = await this.memberships.getTier(membership.tierId);

    if (!isMembershipActive(membership.status, membership.validTo, new Date(), tier.graceDays)) {
      return { decision: 'deny', reason: 'membership_inactive', entitlementRef: membership.id };
    }
    if (!tier.zoneKeys.includes(accessPoint.zoneKey)) {
      return { decision: 'deny', reason: 'zone_not_allowed', entitlementRef: membership.id };
    }
    return { decision: 'allow', reason: null, entitlementRef: membership.id };
  }
}
