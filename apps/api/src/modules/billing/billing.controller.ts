import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/rbac/permissions.guard';
import { AllowAuthenticatedOnly, RequirePermission } from '../../core/rbac/require-permission.decorator';
import { RequireModule } from '../../core/rbac/require-module.decorator';
import { BillingService, type CheckoutResult } from './billing.service';
import { CancelSubscriptionDto, CheckoutDto } from './dto/billing.dto';
import type { Subscription } from './entities/subscription.entity';
import type { Invoice } from './entities/invoice.entity';
import type { PlatformUsageMeter } from './entities/platform-usage-meter.entity';

/** Authed billing endpointy (EPIC-17). Webhook je zvlášť (public, bez JWT). */
@Controller('billing')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequireModule('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Post('checkout')
  @RequirePermission('billing.subscription.manage')
  checkout(@Body() dto: CheckoutDto): Promise<CheckoutResult> {
    return this.billing.checkout(dto);
  }

  @Get('subscriptions')
  @AllowAuthenticatedOnly()
  listSubscriptions(): Promise<Subscription[]> {
    return this.billing.listSubscriptions();
  }

  @Get('subscriptions/:id')
  @AllowAuthenticatedOnly()
  getSubscription(@Param('id', ParseUUIDPipe) id: string): Promise<Subscription> {
    return this.billing.getSubscription(id);
  }

  @Get('subscriptions/:id/invoices')
  @AllowAuthenticatedOnly()
  invoices(@Param('id', ParseUUIDPipe) id: string): Promise<Invoice[]> {
    return this.billing.listInvoices(id);
  }

  @Get('subscriptions/:id/portal')
  @AllowAuthenticatedOnly()
  portal(@Param('id', ParseUUIDPipe) id: string): Promise<{ url: string }> {
    return this.billing.customerPortal(id);
  }

  @Post('subscriptions/:id/cancel')
  @RequirePermission('billing.subscription.manage')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelSubscriptionDto,
  ): Promise<Subscription> {
    return this.billing.cancel(id, dto.immediately ?? false);
  }

  @Get('usage')
  @AllowAuthenticatedOnly()
  usage(): Promise<PlatformUsageMeter[]> {
    return this.billing.listUsage();
  }
}
