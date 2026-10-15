import { Logger } from '@nestjs/common';
import type { InlineButton, TelegramApi } from './telegram.types';

/** Skutečné volání Bot API (token jen z env `TELEGRAM_BOT_TOKEN`). */
export class HttpTelegramApi implements TelegramApi {
  private readonly logger = new Logger(HttpTelegramApi.name);

  constructor(
    private readonly token: string | undefined,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async call(method: string, body: Record<string, unknown>): Promise<void> {
    if (!this.token) {
      this.logger.warn(`Telegram ${method} přeskočeno – TELEGRAM_BOT_TOKEN není nastaven`);
      return;
    }
    const res = await this.fetchImpl(`https://api.telegram.org/bot${this.token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) this.logger.warn(`Telegram ${method} selhalo: HTTP ${res.status}`);
  }

  sendMessage(chatId: number, text: string, buttons?: InlineButton[][]): Promise<void> {
    return this.call('sendMessage', {
      chat_id: chatId,
      text: text.slice(0, 4000),
      disable_web_page_preview: true,
      ...(buttons?.length ? { reply_markup: { inline_keyboard: buttons } } : {}),
    });
  }

  answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
    return this.call('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      ...(text ? { text: text.slice(0, 190) } : {}),
    });
  }
}
