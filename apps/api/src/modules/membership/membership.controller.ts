import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/rbac/permissions.guard';
import { RequirePermission } from '../../core/rbac/require-permission.decorator';
import { MembershipService, type CardView } from './membership.service';
import {
  CreateBenefitDto,
  CreateMemberDto,
  CreateTierDto,
  IssueCardDto,
  IssueMembershipDto,
} from './dto/membership.dto';
import type { Member } from './entities/member.entity';
import type { MembershipTier } from './entities/membership-tier.entity';
import type { Membership } from './entities/membership.entity';
import type { MembershipCard } from './entities/membership-card.entity';
import type { MembershipBenefit } from './entities/membership-benefit.entity';

@Controller('memberships')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MembershipController {
  constructor(private readonly memberships: MembershipService) {}

  @Get('members')
  listMembers(): Promise<Member[]> {
    return this.memberships.listMembers();
  }

  @Post('members')
  @RequirePermission('membership.card.manage')
  createMember(@Body() dto: CreateMemberDto): Promise<Member> {
    return this.memberships.createMember(dto);
  }

  @Post('tiers')
  @RequirePermission('membership.card.manage')
  createTier(@Body() dto: CreateTierDto): Promise<MembershipTier> {
    return this.memberships.createTier(dto);
  }

  @Get('tiers')
  listTiers(): Promise<MembershipTier[]> {
    return this.memberships.listTiers();
  }

  @Post('tiers/:tierId/benefits')
  @RequirePermission('membership.card.manage')
  addBenefit(
    @Param('tierId', ParseUUIDPipe) tierId: string,
    @Body() dto: CreateBenefitDto,
  ): Promise<MembershipBenefit> {
    return this.memberships.addBenefit(tierId, dto);
  }

  @Get('tiers/:tierId/benefits')
  listBenefits(@Param('tierId', ParseUUIDPipe) tierId: string): Promise<MembershipBenefit[]> {
    return this.memberships.listBenefits(tierId);
  }

  @Get()
  listMemberships(): Promise<Membership[]> {
    return this.memberships.listMemberships();
  }

  @Post()
  @RequirePermission('membership.card.manage')
  issue(@Body() dto: IssueMembershipDto): Promise<Membership> {
    return this.memberships.issueMembership(dto);
  }

  @Get(':membershipId')
  get(@Param('membershipId', ParseUUIDPipe) membershipId: string): Promise<Membership> {
    return this.memberships.getMembership(membershipId);
  }

  @Post(':membershipId/suspend')
  @RequirePermission('membership.card.manage')
  suspend(@Param('membershipId', ParseUUIDPipe) membershipId: string): Promise<Membership> {
    return this.memberships.setStatus(membershipId, 'suspended');
  }

  @Post(':membershipId/resume')
  @RequirePermission('membership.card.manage')
  resume(@Param('membershipId', ParseUUIDPipe) membershipId: string): Promise<Membership> {
    return this.memberships.setStatus(membershipId, 'active');
  }

  @Post(':membershipId/cards')
  @RequirePermission('membership.card.manage')
  issueCard(
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
    @Body() dto: IssueCardDto,
  ): Promise<MembershipCard> {
    return this.memberships.issueCard(membershipId, dto);
  }

  @Get('cards/by-carrier/:carrierId')
  async cardView(
    @Param('carrierId', ParseUUIDPipe) carrierId: string,
  ): Promise<CardView | null> {
    const card = await this.memberships.cardByCarrier(carrierId);
    return card ? this.memberships.cardView(card) : null;
  }
}
