import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../tenancy/tenant-context.service';
import { DigitalObject } from '../domain/entities/digital-object.entity';
import { DataCarrier } from '../domain/entities/data-carrier.entity';
import { ScanEvent } from '../domain/entities/scan-event.entity';

export interface AnalyticsOverview {
  totalObjects: number;
  totalCarriers: number;
  totalScans: number;
  scansByModule: { moduleType: string; count: number }[];
  topObjects: { id: string; slug: string; moduleType: string; scans: number }[];
  recentActivity: {
    id: string;
    digitalObjectId: string | null;
    carrierType: string | null;
    eventType: string;
    createdAt: Date;
  }[];
}

/** Čte přes tenant-scoped manager → RLS vrací jen data aktuálního tenantu. */
@Injectable()
export class AnalyticsService {
  constructor(private readonly context: TenantContextService) {}

  async overview(): Promise<AnalyticsOverview> {
    const manager = this.context.manager;
    const [totalObjects, totalCarriers, totalScans] = await Promise.all([
      manager.getRepository(DigitalObject).count(),
      manager.getRepository(DataCarrier).count(),
      manager.getRepository(ScanEvent).count(),
    ]);

    const scansByModule: { moduleType: string; count: number }[] = await manager.query(
      `SELECT d.module_type AS "moduleType", count(*)::int AS count
       FROM scan_events s JOIN digital_objects d ON d.id = s.digital_object_id
       GROUP BY d.module_type ORDER BY count DESC`,
    );

    const topObjects: { id: string; slug: string; moduleType: string; scans: number }[] =
      await manager.query(
        `SELECT d.id, d.slug, d.module_type AS "moduleType", count(s.id)::int AS scans
         FROM digital_objects d LEFT JOIN scan_events s ON s.digital_object_id = d.id
         GROUP BY d.id ORDER BY scans DESC LIMIT 5`,
      );

    const recent = await manager.getRepository(ScanEvent).find({
      order: { createdAt: 'DESC' },
      take: 10,
    });

    return {
      totalObjects,
      totalCarriers,
      totalScans,
      scansByModule,
      topObjects,
      recentActivity: recent.map((s) => ({
        id: s.id,
        digitalObjectId: s.digitalObjectId,
        carrierType: s.carrierType,
        eventType: s.eventType,
        createdAt: s.createdAt,
      })),
    };
  }

  scans(objectId?: string, from?: string, to?: string): Promise<ScanEvent[]> {
    const qb = this.context.manager.getRepository(ScanEvent).createQueryBuilder('s');
    if (objectId) qb.andWhere('s.digital_object_id = :objectId', { objectId });
    if (from) qb.andWhere('s.created_at >= :from', { from });
    if (to) qb.andWhere('s.created_at <= :to', { to });
    return qb.orderBy('s.created_at', 'DESC').take(200).getMany();
  }
}
