import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TenantContextService } from '../../core/tenancy/tenant-context.service';
import { DigitalObject } from '../../core/domain/entities/digital-object.entity';
import { DataCarrier } from '../../core/domain/entities/data-carrier.entity';
import { PlatformUsageMeter } from '../billing/entities/platform-usage-meter.entity';
import { Member } from './entities/member.entity';
import { MembershipTier } from './entities/membership-tier.entity';
import { Membership } from './entities/membership.entity';
import { MembershipCard } from './entities/membership-card.entity';
import { MembershipBenefit } from './entities/membership-benefit.entity';
import { computeEffectiveStatus, extendValidTo } from './membership.logic';
import type {
  CreateBenefitDto,
  CreateMemberDto,
  CreateTierDto,
  IssueCardDto,
  IssueMembershipDto,
} from './dto/membership.dto';

/** Pohled na kartu pro self-service / scan (EPIC-16). */
export interface CardView {
  member: { name: string; email: string | null };
  tier: { name: string; level: number };
  status: string;
  validFrom: string;
  validTo: string;
  zoneKeys: string[];
  benefits: { kind: string; targetKey: string | null; value: string | null }[];
}

@Injectable()
export class MembershipService {
  constructor(private readonly context: TenantContextService) {}

  private repo<T extends object>(entity: { new (): T }): Repository<T> {
    return this.context.manager.getRepository(entity);
  }

  // --- Members ---
  createMember(dto: CreateMemberDto): Promise<Member> {
    const repo = this.repo(Member);
    return repo.save(
      repo.create({
        tenantId: this.context.tenantId,
        name: dto.name,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        externalRef: dto.externalRef ?? null,
      }),
    );
  }

  // --- Tiers ---
  createTier(dto: CreateTierDto): Promise<MembershipTier> {
    const repo = this.repo(MembershipTier);
    return repo.save(
      repo.create({
        tenantId: this.context.tenantId,
        name: dto.name,
        level: dto.level ?? 0,
        price: dto.price ?? '0',
        currency: dto.currency ?? 'CZK',
        validityDays: dto.validityDays ?? 365,
        graceDays: dto.graceDays ?? 7,
        zoneKeys: dto.zoneKeys ?? [],
      }),
    );
  }

  listTiers(): Promise<MembershipTier[]> {
    return this.repo(MembershipTier).find({ order: { level: 'ASC' } });
  }

  async getTier(tierId: string): Promise<MembershipTier> {
    const tier = await this.repo(MembershipTier).findOne({ where: { id: tierId } });
    if (!tier) throw new NotFoundException('Tier neexistuje');
    return tier;
  }

  // --- Benefits ---
  async addBenefit(tierId: string, dto: CreateBenefitDto): Promise<MembershipBenefit> {
    await this.getTier(tierId);
    const repo = this.repo(MembershipBenefit);
    return repo.save(
      repo.create({
        tenantId: this.context.tenantId,
        tierId,
        kind: dto.kind,
        targetKey: dto.targetKey ?? null,
        value: dto.value ?? null,
        description: dto.description ?? null,
      }),
    );
  }

  listBenefits(tierId: string): Promise<MembershipBenefit[]> {
    return this.repo(MembershipBenefit).find({ where: { tierId } });
  }

  // --- Memberships ---
  async issueMembership(dto: IssueMembershipDto): Promise<Membership> {
    const tier = await this.getTier(dto.tierId);
    const member = await this.repo(Member).findOne({ where: { id: dto.memberId } });
    if (!member) throw new NotFoundException('Člen neexistuje');

    const validFrom = dto.validFrom ? new Date(dto.validFrom) : new Date();
    const validTo = extendValidTo(validFrom, tier.validityDays, validFrom);

    const repo = this.repo(Membership);
    return repo.save(
      repo.create({
        tenantId: this.context.tenantId,
        memberId: dto.memberId,
        tierId: dto.tierId,
        status: 'active',
        validFrom,
        validTo,
        autoRenew: dto.autoRenew ?? false,
        subscriptionId: null,
      }),
    );
  }

  async getMembership(membershipId: string): Promise<Membership> {
    const m = await this.repo(Membership).findOne({ where: { id: membershipId } });
    if (!m) throw new NotFoundException('Členství neexistuje');
    return m;
  }

  /** Pozastavení/obnovení členství (ruční stav má přednost před platností). */
  async setStatus(
    membershipId: string,
    status: 'active' | 'suspended' | 'cancelled',
  ): Promise<Membership> {
    const m = await this.getMembership(membershipId);
    m.status = status;
    return this.repo(Membership).save(m);
  }

  /** Naváže členství na předplatné (EPIC-17). */
  async linkSubscription(membershipId: string, subscriptionId: string): Promise<Membership> {
    const m = await this.getMembership(membershipId);
    m.subscriptionId = subscriptionId;
    m.autoRenew = true;
    return this.repo(Membership).save(m);
  }

  /** Obnovení po zaplacené faktuře: prodlouží platnost o období tieru. */
  async renew(membershipId: string): Promise<Membership> {
    const m = await this.getMembership(membershipId);
    const tier = await this.getTier(m.tierId);
    m.validTo = extendValidTo(m.validTo, tier.validityDays);
    if (m.status !== 'cancelled') m.status = 'active';
    return this.repo(Membership).save(m);
  }

  /** Nastaví přímo uložený stav členství (interní, pro billing lifecycle). */
  async setMembershipStatus(membershipId: string, status: Membership['status']): Promise<Membership> {
    const m = await this.getMembership(membershipId);
    m.status = status;
    return this.repo(Membership).save(m);
  }

  // --- Cards ---
  async issueCard(membershipId: string, dto: IssueCardDto): Promise<MembershipCard> {
    const membership = await this.getMembership(membershipId);

    const carrierRepo = this.repo(DataCarrier);
    const carrier = await carrierRepo.findOne({ where: { id: dto.dataCarrierId } });
    if (!carrier) throw new NotFoundException('Nosič neexistuje');
    if (carrier.digitalObjectId) {
      throw new BadRequestException('Nosič je už přiřazený jinému objektu');
    }

    // Karta = DigitalObject typu membership, na který nosič ukazuje (resolver).
    const objectRepo = this.repo(DigitalObject);
    const object = await objectRepo.save(
      objectRepo.create({
        tenantId: this.context.tenantId,
        moduleType: 'membership',
        slug: `membership-${membership.id}-${carrier.id.slice(0, 8)}`,
        status: 'active',
        metadata: { membershipId },
      }),
    );
    carrier.digitalObjectId = object.id;
    carrier.status = 'active';
    await carrierRepo.save(carrier);

    const cardRepo = this.repo(MembershipCard);
    const card = await cardRepo.save(
      cardRepo.create({
        tenantId: this.context.tenantId,
        membershipId,
        dataCarrierId: carrier.id,
        status: 'active',
      }),
    );

    // Tok 2 (EPIC-17): metering vydaných karet pro platformový SaaS fee.
    await this.incrementCardMeter();
    return card;
  }

  private async incrementCardMeter(): Promise<void> {
    const period = new Date().toISOString().slice(0, 7); // YYYY-MM
    const repo = this.repo(PlatformUsageMeter);
    const existing = await repo.findOne({ where: { period, metric: 'cards_issued' } });
    if (existing) {
      existing.quantity += 1;
      await repo.save(existing);
    } else {
      await repo.save(
        repo.create({
          tenantId: this.context.tenantId,
          period,
          metric: 'cards_issued',
          quantity: 1,
          reportedAt: null,
        }),
      );
    }
  }

  /** Kartu najde přes nosič (pro scan handler i entitlement provider). */
  async cardByCarrier(carrierId: string): Promise<MembershipCard | null> {
    return this.repo(MembershipCard).findOne({ where: { dataCarrierId: carrierId } });
  }

  /** Sestaví self-service pohled na kartu (member + tier + benefity + zóny). */
  async cardView(card: MembershipCard, now: Date = new Date()): Promise<CardView> {
    const membership = await this.getMembership(card.membershipId);
    const tier = await this.getTier(membership.tierId);
    const member = await this.repo(Member).findOne({ where: { id: membership.memberId } });
    const benefits = await this.listBenefits(tier.id);
    const status = computeEffectiveStatus(
      membership.status,
      membership.validTo,
      now,
      tier.graceDays,
    );
    return {
      member: { name: member?.name ?? '—', email: member?.email ?? null },
      tier: { name: tier.name, level: tier.level },
      status,
      validFrom: membership.validFrom.toISOString(),
      validTo: membership.validTo.toISOString(),
      zoneKeys: tier.zoneKeys,
      benefits: benefits.map((b) => ({ kind: b.kind, targetKey: b.targetKey, value: b.value })),
    };
  }
}
