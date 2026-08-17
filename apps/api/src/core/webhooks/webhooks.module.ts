import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookEndpoint } from './entities/webhook-endpoint.entity';
import { WebhookDelivery } from './entities/webhook-delivery.entity';
import { WebhookService } from './webhook.service';
import { WebhooksController } from './webhooks.controller';

/** Doménové webhooky – globální, aby doména (asset/inventory) mohla emitovat. */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([WebhookEndpoint, WebhookDelivery])],
  controllers: [WebhooksController],
  providers: [WebhookService],
  exports: [WebhookService],
})
export class WebhooksModule {}
