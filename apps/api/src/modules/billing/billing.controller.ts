import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { RolesGuard, RequireRole } from '../../core/rbac/roles.guard';
import { BillingService, type CheckoutResult } from './billing.service';
import { CancelSubscriptionDto, CheckoutDto } from './dto/billing.dto';
import type { Subscription } from './entities/subscription.entity';
import type { Invoice } from './entities/invoice.entity';
import type { PlatformUsageMeter } from './entities/platform-usage-meter.entity';

/** Authed billing endpointy (EPIC-17). Webhook je zvlášť (public, bez JWT). */
@Controller('billing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Post('checkout')
  @RequireRole('MANAGER')
  checkout(@Body() dto: CheckoutDto): Promise<CheckoutResult> {
    return this.billing.checkout(dto);
  }

  @Get('subscriptions')
  listSubscriptions(): Promise<Subscription[]> {
    return this.billing.listSubscriptions();
  }

  @Get('subscriptions/:id')
  getSubscription(@Param('id', ParseUUIDPipe) id: string): Promise<Subscription> {
    return this.billing.getSubscription(id);
  }

  @Get('subscriptions/:id/invoices')
  invoices(@Param('id', ParseUUIDPipe) id: string): Promise<Invoice[]> {
    return this.billing.listInvoices(id);
  }

  @Get('subscriptions/:id/portal')
  portal(@Param('id', ParseUUIDPipe) id: string): Promise<{ url: string }> {
    return this.billing.customerPortal(id);
  }

  @Post('subscriptions/:id/cancel')
  @RequireRole('MANAGER')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelSubscriptionDto,
  ): Promise<Subscription> {
    return this.billing.cancel(id, dto.immediately ?? false);
  }

  @Get('usage')
  usage(): Promise<PlatformUsageMeter[]> {
    return this.billing.listUsage();
  }
}
