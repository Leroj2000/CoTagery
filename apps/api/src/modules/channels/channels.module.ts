import { Module } from '@nestjs/common';
import { AssetModule } from '../asset/asset.module';
import { ActionExecutorService } from './actions/action-executor.service';
import { ActionRegistry } from './actions/action-registry.service';
import { V1ActionsProvider } from './actions/v1.actions';

/**
 * EPIC-22: ovládání přes kanály (Telegram, MCP). Jádro = ActionRegistry +
 * ActionExecutor; adaptéry kanálů jsou tenké vrstvy nad nimi.
 */
@Module({
  imports: [AssetModule],
  providers: [V1ActionsProvider, ActionRegistry, ActionExecutorService],
  exports: [ActionRegistry, ActionExecutorService],
})
export class ChannelsModule {}
