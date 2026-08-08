import { Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TenantContextService } from '../tenancy/tenant-context.service';
import { AccessPoint } from './entities/access-point.entity';
import { AccessEvent } from './entities/access-event.entity';
import { AccessRegistry, type AccessDecision } from './entitlement';
import type { CreateAccessPointDto } from './dto/access.dto';

@Injectable()
export class AccessControlService {
  constructor(
    private readonly context: TenantContextService,
    private readonly registry: AccessRegistry,
  ) {}

  private points(): Repository<AccessPoint> {
    return this.context.manager.getRepository(AccessPoint);
  }

  private events(): Repository<AccessEvent> {
    return this.context.manager.getRepository(AccessEvent);
  }

  list(): Promise<AccessPoint[]> {
    return this.points().find({ order: { createdAt: 'ASC' } });
  }

  create(dto: CreateAccessPointDto): Promise<AccessPoint> {
    const point = this.points().create({
      tenantId: this.context.tenantId,
      name: dto.name,
      zoneKey: dto.zoneKey,
      locationId: dto.locationId ?? null,
      direction: dto.direction ?? 'in',
      settings: dto.settings ?? {},
    });
    return this.points().save(point);
  }

  async get(id: string): Promise<AccessPoint> {
    const point = await this.points().findOne({ where: { id } });
    if (!point) throw new NotFoundException('Access point neexistuje');
    return point;
  }

  listEvents(accessPointId: string): Promise<AccessEvent[]> {
    return this.events().find({
      where: { accessPointId },
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  /** Vyhodnotí vstup: nárok od providera + audit AccessEvent (ADR-0006). */
  async evaluate(
    accessPointId: string,
    subjectType: string,
    subjectRef: string,
  ): Promise<AccessDecision> {
    const point = await this.get(accessPointId);
    const provider = this.registry.get(subjectType);

    const decision: AccessDecision = provider
      ? await provider.evaluate(subjectRef, point)
      : { decision: 'deny', reason: 'no_provider', entitlementRef: null };

    await this.events().save(
      this.events().create({
        tenantId: this.context.tenantId,
        accessPointId: point.id,
        subjectType,
        subjectRef,
        decision: decision.decision,
        reason: decision.reason,
        entitlementRef: decision.entitlementRef,
      }),
    );
    return decision;
  }
}
