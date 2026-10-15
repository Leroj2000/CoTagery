import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AssetModule } from '../asset/asset.module';
import { ActionExecutorService } from './actions/action-executor.service';
import { ActionRegistry } from './actions/action-registry.service';
import { V1ActionsProvider } from './actions/v1.actions';
import { ChannelsController } from './channels.controller';
import { ChannelIdentityService } from './identity/channel-identity.service';
import { TelegramBotService } from './telegram/telegram-bot.service';
import { HttpTelegramApi } from './telegram/telegram-http.api';
import { TelegramWebhookController } from './telegram/telegram.controller';
import { TELEGRAM_API } from './telegram/telegram.types';

/**
 * EPIC-22: ovládání přes kanály (Telegram, MCP). Jádro = ActionRegistry +
 * ActionExecutor; adaptéry kanálů jsou tenké vrstvy nad nimi.
 */
@Module({
  imports: [AssetModule],
  controllers: [ChannelsController, TelegramWebhookController],
  providers: [
    V1ActionsProvider,
    ActionRegistry,
    ActionExecutorService,
    ChannelIdentityService,
    TelegramBotService,
    {
      provide: TELEGRAM_API,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new HttpTelegramApi(config.get<string>('TELEGRAM_BOT_TOKEN')),
    },
  ],
  exports: [ActionRegistry, ActionExecutorService, ChannelIdentityService],
})
export class ChannelsModule {}
