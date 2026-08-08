import { Injectable } from '@nestjs/common';
import type { ModuleType } from '@tagery/shared';
import type { DigitalObject } from './entities/digital-object.entity';
import type { DataCarrier } from './entities/data-carrier.entity';

export interface ScanContext {
  carrierType: 'qr' | 'nfc';
  ip?: string;
  userAgent?: string;
}

export interface ScanResponse {
  kind: 'html' | 'json' | 'redirect';
  body?: unknown;
  url?: string;
}

/**
 * Kontrakt, který implementuje každý modul obsluhující sken (ADR-0002).
 * Resolver (EPIC-05) podle `module_type` zavolá odpovídající handler.
 */
export interface ModuleHandler {
  readonly moduleType: ModuleType;
  handleScan(object: DigitalObject, carrier: DataCarrier, ctx: ScanContext): Promise<ScanResponse>;
}

/** Registr modulových handlerů; moduly se zaregistrují při startu (EPIC-08+). */
@Injectable()
export class ModuleRegistry {
  private readonly handlers = new Map<ModuleType, ModuleHandler>();

  register(handler: ModuleHandler): void {
    this.handlers.set(handler.moduleType, handler);
  }

  get(moduleType: ModuleType): ModuleHandler | undefined {
    return this.handlers.get(moduleType);
  }
}
