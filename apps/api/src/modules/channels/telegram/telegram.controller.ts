import { timingSafeEqual } from 'node:crypto';
import {
  Body,
  Controller,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramBotService } from './telegram-bot.service';
import type { TelegramUpdate } from './telegram.types';

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Webhook Telegram bota: `/api/v1/channels/telegram/webhook/:secret` + hlavička
 * `X-Telegram-Bot-Api-Secret-Token` (obojí = `TELEGRAM_WEBHOOK_SECRET`).
 * Bez nastaveného secretu je kanál vypnutý (404). Odpověď je vždy rychlé 200 –
 * Telegram jinak doručení opakuje; idempotence je v service.
 */
@Controller('channels/telegram')
export class TelegramWebhookController {
  constructor(
    private readonly bot: TelegramBotService,
    private readonly config: ConfigService,
  ) {}

  @Post('webhook/:secret')
  @HttpCode(200)
  async webhook(
    @Param('secret') secret: string,
    @Headers('x-telegram-bot-api-secret-token') header: string | undefined,
    @Body() update: TelegramUpdate,
  ): Promise<{ ok: true }> {
    const expected = this.config.get<string>('TELEGRAM_WEBHOOK_SECRET');
    if (!expected || !safeEqual(secret, expected) || !safeEqual(header ?? '', expected)) {
      throw new NotFoundException();
    }
    await this.bot.handleUpdate(update);
    return { ok: true };
  }
}
