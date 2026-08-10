import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MembershipModule } from '../membership/membership.module';
import { BillingCustomer } from './entities/billing-customer.entity';
import { Subscription } from './entities/subscription.entity';
import { Invoice } from './entities/invoice.entity';
import { BillingWebhookEvent } from './entities/billing-webhook-event.entity';
import { PlatformUsageMeter } from './entities/platform-usage-meter.entity';
import { BillingService } from './billing.service';
import { BillingWebhookService } from './billing-webhook.service';
import { StubPspService } from './stub-psp.service';
import { BillingController } from './billing.controller';
import { BillingWebhookController } from './billing-webhook.controller';

/**
 * EPIC-17 Billing (stub PSP) – předplatné, faktury, webhooky, metering.
 * Konzumuje MembershipModule (řídí platnost členství). PSP je zatím stub
 * (ADR-0007: čeká na rozhodnutí Stripe vs jiné); reálná integrace vymění
 * StubPspService za adaptér.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      BillingCustomer,
      Subscription,
      Invoice,
      BillingWebhookEvent,
      PlatformUsageMeter,
    ]),
    MembershipModule,
  ],
  controllers: [BillingController, BillingWebhookController],
  providers: [BillingService, BillingWebhookService, StubPspService],
})
export class BillingModule {}
