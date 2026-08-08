import { Injectable, OnModuleInit } from '@nestjs/common';
import { TenantContextService } from '../../core/tenancy/tenant-context.service';
import { AccessRegistry, type AccessDecision, type EntitlementProvider } from '../../core/access/entitlement';
import { Ticket } from './entities/ticket.entity';

/**
 * Poskytovatel nároku pro subjectType 'ticket' (ADR-0006). Při povolení vstupu
 * vstupenku redeemuje (check-in). Běží v tenant kontextu předaném z access-control.
 */
@Injectable()
export class TicketEntitlementProvider implements EntitlementProvider, OnModuleInit {
  readonly subjectType = 'ticket';

  constructor(
    private readonly registry: AccessRegistry,
    private readonly context: TenantContextService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async evaluate(subjectRef: string): Promise<AccessDecision> {
    const repo = this.context.manager.getRepository(Ticket);
    let ticket: Ticket | null;
    try {
      ticket = await repo.findOne({ where: { id: subjectRef } });
    } catch {
      return { decision: 'deny', reason: 'invalid_ticket', entitlementRef: null };
    }
    if (!ticket) return { decision: 'deny', reason: 'not_found', entitlementRef: null };
    if (ticket.status === 'redeemed') {
      return { decision: 'deny', reason: 'already_redeemed', entitlementRef: ticket.id };
    }
    if (ticket.status !== 'paid') {
      return { decision: 'deny', reason: `status_${ticket.status}`, entitlementRef: ticket.id };
    }
    ticket.status = 'redeemed';
    ticket.redeemedAt = new Date();
    await repo.save(ticket);
    return { decision: 'allow', reason: null, entitlementRef: ticket.id };
  }
}
