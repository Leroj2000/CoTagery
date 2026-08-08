import { Injectable } from '@nestjs/common';
import type { AccessPoint } from './entities/access-point.entity';

export interface AccessDecision {
  decision: 'allow' | 'deny';
  reason: string | null;
  entitlementRef: string | null;
}

/**
 * Poskytovatel nároku (ADR-0006). Implementují moduly (Ticketing, Membership).
 * `subjectType` určuje, pro jaký typ subjektu provider platí (např. 'ticket').
 */
export interface EntitlementProvider {
  readonly subjectType: string;
  evaluate(subjectRef: string, accessPoint: AccessPoint): Promise<AccessDecision>;
}

/** Registr poskytovatelů nároku podle subjectType. */
@Injectable()
export class AccessRegistry {
  private readonly providers = new Map<string, EntitlementProvider>();

  register(provider: EntitlementProvider): void {
    this.providers.set(provider.subjectType, provider);
  }

  get(subjectType: string): EntitlementProvider | undefined {
    return this.providers.get(subjectType);
  }
}
