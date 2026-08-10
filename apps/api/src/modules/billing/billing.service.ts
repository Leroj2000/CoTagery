import { Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { TenantContextService } from '../../core/tenancy/tenant-context.service';
import { MembershipService } from '../membership/membership.service';
import { extendValidTo } from '../membership/membership.logic';
import { BillingCustomer } from './entities/billing-customer.entity';
import { Subscription } from './entities/subscription.entity';
import { Invoice } from './entities/invoice.entity';
import { PlatformUsageMeter } from './entities/platform-usage-meter.entity';
import { StubPspService } from './stub-psp.service';
import { computeVat } from './billing.logic';
import type { CheckoutDto } from './dto/billing.dto';

export interface CheckoutResult {
  checkoutUrl: string;
  subscriptionId: string;
  membershipId: string;
}

@Injectable()
export class BillingService {
  constructor(
    private readonly context: TenantContextService,
    private readonly memberships: MembershipService,
    private readonly psp: StubPspService,
    private readonly config: ConfigService,
  ) {}

  private repo<T extends object>(entity: { new (): T }): Repository<T> {
    return this.context.manager.getRepository(entity);
  }

  /**
   * Checkout: založí (stub) PSP session, billing zákazníka, předplatné a
   * členství. Členství se aktivuje až po `invoice.paid` webhooku (nebo hned
   * v rámci trialu). Vrací fake checkout URL – reálně přesměruje na PSP.
   */
  async checkout(dto: CheckoutDto): Promise<CheckoutResult> {
    const tier = await this.memberships.getTier(dto.tierId);
    const session = this.psp.createCheckoutSession();

    // Billing zákazník (zrcadlí PSP customer).
    const customerRepo = this.repo(BillingCustomer);
    const customer = await customerRepo.save(
      customerRepo.create({
        tenantId: this.context.tenantId,
        memberId: dto.memberId,
        pspCustomerRef: session.pspCustomerRef,
        email: dto.email ?? null,
      }),
    );

    const trialDays = dto.trialDays ?? 0;
    const now = new Date();
    const periodEnd = extendValidTo(now, trialDays > 0 ? trialDays : tier.validityDays, now);

    // Členství – dokud není zaplaceno, drží se přes trial nebo čeká na invoice.paid.
    const membership = await this.memberships.issueMembership({
      memberId: dto.memberId,
      tierId: dto.tierId,
      autoRenew: true,
    });
    // Trialing → aktivní hned; jinak čeká na platbu (suspended do invoice.paid).
    await this.memberships.setMembershipStatus(
      membership.id,
      trialDays > 0 ? 'active' : 'suspended',
    );

    const subRepo = this.repo(Subscription);
    const subscription = await subRepo.save(
      subRepo.create({
        tenantId: this.context.tenantId,
        billingCustomerId: customer.id,
        membershipId: membership.id,
        tierId: tier.id,
        status: trialDays > 0 ? 'trialing' : 'incomplete',
        pspSubscriptionRef: session.pspSubscriptionRef,
        currentPeriodEnd: periodEnd,
      }),
    );
    await this.memberships.linkSubscription(membership.id, subscription.id);

    return {
      checkoutUrl: session.checkoutUrl,
      subscriptionId: subscription.id,
      membershipId: membership.id,
    };
  }

  async getSubscription(subscriptionId: string): Promise<Subscription> {
    const sub = await this.repo(Subscription).findOne({ where: { id: subscriptionId } });
    if (!sub) throw new NotFoundException('Předplatné neexistuje');
    return sub;
  }

  listInvoices(subscriptionId: string): Promise<Invoice[]> {
    return this.repo(Invoice).find({
      where: { subscriptionId },
      order: { createdAt: 'DESC' },
    });
  }

  /** URL PSP zákaznického portálu pro self-service správu předplatného. */
  async customerPortal(subscriptionId: string): Promise<{ url: string }> {
    const sub = await this.getSubscription(subscriptionId);
    const customer = await this.repo(BillingCustomer).findOne({
      where: { id: sub.billingCustomerId },
    });
    if (!customer) throw new NotFoundException('Billing zákazník neexistuje');
    return { url: this.psp.customerPortalUrl(customer.pspCustomerRef) };
  }

  /** Zrušení předplatného (na konci období nebo okamžitě). */
  async cancel(subscriptionId: string, immediately: boolean): Promise<Subscription> {
    const sub = await this.getSubscription(subscriptionId);
    if (immediately) {
      sub.status = 'canceled';
      if (sub.membershipId) {
        await this.memberships.setMembershipStatus(sub.membershipId, 'cancelled');
      }
    } else {
      sub.cancelAtPeriodEnd = true;
    }
    return this.repo(Subscription).save(sub);
  }

  /** Přehled metering (Tok 2) pro report do PSP. */
  listUsage(): Promise<PlatformUsageMeter[]> {
    return this.repo(PlatformUsageMeter).find({ order: { period: 'DESC' } });
  }

  /**
   * Vytvoří fakturu pro předplatné (zrcadlí PSP invoice). Rozpad DPH dle
   * reverse-charge; v stubu voláno z webhooku `invoice.paid`.
   */
  async recordPaidInvoice(sub: Subscription, reverseCharge = false): Promise<Invoice> {
    const tier = await this.memberships.getTier(sub.tierId);
    const vat = computeVat(tier.price, 21, reverseCharge);
    const repo = this.repo(Invoice);
    return repo.save(
      repo.create({
        tenantId: this.context.tenantId,
        subscriptionId: sub.id,
        pspInvoiceRef: this.psp.newInvoiceRef(),
        amountNet: tier.price,
        vatAmount: vat.vatAmount,
        vatRate: vat.vatRate,
        reverseCharge,
        currency: tier.currency,
        status: 'paid',
        periodStart: new Date(),
        periodEnd: sub.currentPeriodEnd,
      }),
    );
  }
}
