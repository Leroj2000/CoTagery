import { Global, Module } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { EntitlementsService } from './entitlements.service';
import { SubscriptionController } from './subscription.controller';
import { InvoicesService } from './invoices.service';
import { StorageUsageService } from './storage-usage.service';

/**
 * Předplatné firem vůči Tagery (EPIC-20 v2, ADR-0009): úrovně, předplatné,
 * projekce modulů/funkcí a limity. Globální – limity se hlídají v mnoha modulech.
 */
@Global()
@Module({
  controllers: [SubscriptionController],
  providers: [SubscriptionService, EntitlementsService, InvoicesService, StorageUsageService],
  exports: [SubscriptionService, EntitlementsService, InvoicesService, StorageUsageService],
})
export class PlansModule {}
