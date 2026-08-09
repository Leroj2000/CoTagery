import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ResolverCacheService } from './resolver-cache.service';
import type { Resolution } from './resolution';

interface ResolveRow {
  carrier_id: string;
  tenant_id: string;
  digital_object_id: string | null;
  carrier_type: string;
  carrier_status: string;
  module_type: Resolution['moduleType'];
  object_status: string | null;
  valid_from: Date | null;
  valid_to: Date | null;
  primary_url: string | null;
  slug: string | null;
}

@Injectable()
export class ResolverService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly cache: ResolverCacheService,
  ) {}

  /** public_code → Resolution (cache → SECURITY DEFINER lookup mimo RLS). */
  async resolve(code: string): Promise<Resolution | null> {
    const cached = await this.cache.read(code);
    if (cached) return cached;

    const rows: ResolveRow[] = await this.dataSource.query('SELECT * FROM resolve_carrier($1)', [
      code,
    ]);
    if (rows.length === 0) return null;

    const row = rows[0];
    const resolution: Resolution = {
      carrierId: row.carrier_id,
      tenantId: row.tenant_id,
      objectId: row.digital_object_id,
      carrierType: row.carrier_type,
      carrierStatus: row.carrier_status,
      moduleType: row.module_type,
      objectStatus: row.object_status,
      validFrom: row.valid_from ? new Date(row.valid_from).toISOString() : null,
      validTo: row.valid_to ? new Date(row.valid_to).toISOString() : null,
      primaryUrl: row.primary_url,
      slug: row.slug,
    };
    await this.cache.write(code, resolution);
    return resolution;
  }
}
