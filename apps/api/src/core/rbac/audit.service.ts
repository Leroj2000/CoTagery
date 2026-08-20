import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TenantContextService } from '../tenancy/tenant-context.service';
import { AuditEvent } from './entities/audit-event.entity';

export interface AuditInput {
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  context?: Record<string, unknown> | null;
}

/** Auditní log citlivých změn (EPIC-18 Fáze 4). Actor z tenant kontextu. */
@Injectable()
export class AuditService {
  constructor(private readonly context: TenantContextService) {}

  private repo(): Repository<AuditEvent> {
    return this.context.manager.getRepository(AuditEvent);
  }

  /** Zapíše auditní událost. Tiché selhání nesmí shodit hlavní operaci. */
  async record(input: AuditInput): Promise<void> {
    try {
      const repo = this.repo();
      await repo.save(
        repo.create({
          tenantId: this.context.tenantId,
          actorUserId: this.context.userId ?? null,
          action: input.action,
          targetType: input.targetType ?? null,
          targetId: input.targetId ?? null,
          before: input.before ?? null,
          after: input.after ?? null,
          context: input.context ?? null,
        }),
      );
    } catch {
      /* audit nesmí blokovat */
    }
  }

  list(limit = 100): Promise<AuditEvent[]> {
    return this.repo().find({ order: { createdAt: 'DESC' }, take: Math.min(500, Math.max(1, limit)) });
  }
}
