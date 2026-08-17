import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsArray, IsOptional, IsString, IsUrl } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, RequireRole } from '../rbac/roles.guard';
import { WebhookService } from './webhook.service';
import type { WebhookEndpoint } from './entities/webhook-endpoint.entity';
import type { WebhookDelivery } from './entities/webhook-delivery.entity';

class CreateEndpointDto {
  @IsUrl({ require_tld: false })
  url!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  events?: string[];
}

/** Správa webhook odběrů (ADMIN+). */
@Controller('webhooks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WebhooksController {
  constructor(private readonly webhooks: WebhookService) {}

  @Get()
  list(): Promise<WebhookEndpoint[]> {
    return this.webhooks.list();
  }

  @Get('deliveries')
  deliveries(): Promise<WebhookDelivery[]> {
    return this.webhooks.listDeliveries();
  }

  @Post()
  @RequireRole('ADMIN')
  create(@Body() dto: CreateEndpointDto): Promise<WebhookEndpoint> {
    return this.webhooks.create({ url: dto.url, events: dto.events });
  }

  @Post(':id/test')
  @RequireRole('ADMIN')
  test(@Param('id', ParseUUIDPipe) id: string): Promise<WebhookDelivery> {
    return this.webhooks.test(id);
  }

  @Delete(':id')
  @RequireRole('ADMIN')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.webhooks.remove(id);
  }
}
