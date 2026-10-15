import { Injectable } from '@nestjs/common';
import type { AnyChannelAction } from './channel-action';
import { V1ActionsProvider } from './v1.actions';

/** Katalog akcí dostupných kanálům (jediný zdroj pro Telegram i MCP nástroje). */
@Injectable()
export class ActionRegistry {
  private readonly byKey = new Map<string, AnyChannelAction>();

  constructor(v1: V1ActionsProvider) {
    for (const action of v1.actions()) this.register(action);
  }

  register(action: AnyChannelAction): void {
    if (this.byKey.has(action.key)) throw new Error(`Duplicitní akce ${action.key}`);
    this.byKey.set(action.key, action);
  }

  get(key: string): AnyChannelAction | undefined {
    return this.byKey.get(key);
  }

  list(): AnyChannelAction[] {
    return [...this.byKey.values()];
  }
}
