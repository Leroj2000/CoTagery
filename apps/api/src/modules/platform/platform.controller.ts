import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { PlanDefinition } from '@tagery/shared';
import { JwtAuthGuard, type RequestUser } from '../../core/auth/jwt-auth.guard';
import { CurrentUser } from '../../core/auth/decorators';
import { PlatformAdminGuard } from './platform-admin.guard';
import {
  PlatformService,
  type CreatedTenant,
  type TenantDetail,
  type TenantSummary,
} from './platform.service';
import {
  CreateInvoiceDto,
  CreateTenantDto,
  ExtendSubscriptionDto,
  MarkInvoicePaidDto,
  UpdatePlanDto,
  UpdatePlatformSettingsDto,
  UpdateSubscriptionDto,
} from './dto/platform.dto';
import { SubscriptionService, type PlatformSettings } from '../../core/plans/subscription.service';
import { InvoicesService, type PlatformInvoice } from '../../core/plans/invoices.service';
import type { EntitlementKey } from '@tagery/shared';

/**
 * Platform-admin API (ADR-0009, EPIC-20): správa všech firem, jejich předplatného,
 * úrovní a faktur. Jen pro `is_platform_admin` (JwtAuthGuard ověří identitu,
 * PlatformAdminGuard flag).
 */
@Controller('platform')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class PlatformController {
  constructor(
    private readonly platform: PlatformService,
    private readonly subscriptions: SubscriptionService,
    private readonly invoices: InvoicesService,
  ) {}

  @Get('tenants')
  listTenants(): Promise<TenantSummary[]> {
    return this.platform.listTenants();
  }

  @Post('tenants')
  createTenant(@Body() dto: CreateTenantDto): Promise<CreatedTenant> {
    return this.platform.createTenant(dto);
  }

  @Get('tenants/:id')
  tenant(@Param('id', ParseUUIDPipe) id: string): Promise<TenantDetail> {
    return this.platform.tenantDetail(id);
  }

  @Put('tenants/:id/subscription')
  updateSubscription(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubscriptionDto,
    @CurrentUser() user: RequestUser,
  ): Promise<TenantDetail> {
    return this.platform.updateSubscription(id, dto, user.userId);
  }

  @Post('tenants/:id/subscription/extend')
  extend(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExtendSubscriptionDto,
    @CurrentUser() user: RequestUser,
  ): Promise<TenantDetail> {
    return this.platform.extendSubscription(id, dto.days, user.userId);
  }

  @Post('tenants/:id/invoices')
  createInvoice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateInvoiceDto,
    @CurrentUser() user: RequestUser,
  ): Promise<PlatformInvoice> {
    return this.platform.createInvoice(id, dto, user.userId);
  }

  @Post('invoices/:id/paid')
  markPaid(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkInvoicePaidDto,
    @CurrentUser() user: RequestUser,
  ): Promise<PlatformInvoice> {
    return this.invoices.markPaid(id, dto.paidOn, dto.extend ?? true, user.userId);
  }

  @Post('invoices/:id/cancel')
  cancelInvoice(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<PlatformInvoice> {
    return this.invoices.cancel(id, user.userId);
  }

  @Get('invoices/:id/pdf')
  async invoicePdf(@Param('id', ParseUUIDPipe) id: string): Promise<StreamableFile> {
    const inv = await this.invoices.get(id);
    return new StreamableFile(await this.invoices.pdf(inv), {
      type: 'application/pdf',
      disposition: `inline; filename="faktura-${inv.number}.pdf"`,
    });
  }

  @Get('plans')
  plans(): Promise<PlanDefinition[]> {
    return this.subscriptions.plans();
  }

  @Put('plans/:key')
  updatePlan(
    @Param('key') key: string,
    @Body() dto: UpdatePlanDto,
    @CurrentUser() user: RequestUser,
  ): Promise<PlanDefinition> {
    return this.subscriptions.updatePlan(
      key,
      { ...dto, entitlements: dto.entitlements as EntitlementKey[] | undefined },
      user.userId,
    );
  }

  @Get('settings')
  settings(): Promise<PlatformSettings> {
    return this.subscriptions.settings();
  }

  @Put('settings')
  updateSettings(
    @Body() dto: UpdatePlatformSettingsDto,
    @CurrentUser() user: RequestUser,
  ): Promise<PlatformSettings> {
    return this.subscriptions.updateSettings(dto as Partial<PlatformSettings>, user.userId);
  }
}
