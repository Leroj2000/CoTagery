import { Controller, Get, Param, ParseUUIDPipe, StreamableFile, UseGuards } from '@nestjs/common';
import type { PlanDefinition, SubscriptionStatus } from '@tagery/shared';
import { JwtAuthGuard, type RequestUser } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { AllowAuthenticatedOnly, RequirePermission } from '../rbac/require-permission.decorator';
import { SubscriptionService, type SubscriptionOverview } from './subscription.service';
import { EntitlementsService, type LimitUsage } from './entitlements.service';
import { InvoicesService, type PlatformInvoice } from './invoices.service';

export interface SubscriptionStatusView {
  planName: string;
  status: SubscriptionStatus;
  periodEnd: string | null;
  daysLeft: number | null;
}

export interface TenantSubscriptionView extends SubscriptionOverview {
  usage: LimitUsage[];
  invoices: PlatformInvoice[];
  publicPlans: PlanDefinition[];
  /** Kontakt na Tagery pro změnu úrovně (dodavatel z nastavení platformy). */
  contact: { name: string; email: string };
}

/** Předplatné aktuální firmy (čtení; mění jen platform-admin). */
@Controller('subscription')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SubscriptionController {
  constructor(
    private readonly subscriptions: SubscriptionService,
    private readonly entitlements: EntitlementsService,
    private readonly invoices: InvoicesService,
  ) {}

  /** Stav pro banner (zkušební doba, po splatnosti) – vidí každý přihlášený. */
  @Get('status')
  @AllowAuthenticatedOnly()
  async status(@CurrentUser() user: RequestUser): Promise<SubscriptionStatusView> {
    const o = await this.subscriptions.overview(user.tenantId);
    return {
      planName: o.plan.name,
      status: o.subscription.status,
      periodEnd: o.subscription.periodEnd,
      daysLeft: o.daysLeft,
    };
  }

  @Get()
  @RequirePermission('core.organization.view')
  async view(@CurrentUser() user: RequestUser): Promise<TenantSubscriptionView> {
    const overview = await this.subscriptions.overview(user.tenantId);
    const usage = await this.entitlements.usage();
    const invoices = await this.invoices.list(user.tenantId);
    const publicPlans = (await this.subscriptions.plans()).filter((p) => p.isPublic);
    const { supplier } = await this.subscriptions.settings();
    // Interní poznámka superadmina firmě nepatří.
    return {
      ...overview,
      subscription: { ...overview.subscription, note: null },
      usage,
      invoices,
      publicPlans,
      contact: { name: supplier.name, email: supplier.email },
    };
  }

  @Get('invoices/:id/pdf')
  @RequirePermission('core.organization.configure')
  async invoicePdf(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<StreamableFile> {
    const inv = await this.invoices.get(id, user.tenantId);
    return new StreamableFile(await this.invoices.pdf(inv), {
      type: 'application/pdf',
      disposition: `inline; filename="faktura-${inv.number}.pdf"`,
    });
  }
}
