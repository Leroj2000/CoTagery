import { ConflictException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { TenantContextService } from './tenant-context.service';

/** Persists the exact acknowledgement in the same transaction as the operation. */
@Injectable()
export class OperationReceiptsService {
  constructor(private readonly context: TenantContextService) {}
  async once<T>(kind: string, actor: string, requestId: string, payload: unknown, execute: () => Promise<T>): Promise<T> {
    const hash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    const manager = this.context.manager;
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`operation:${this.context.tenantId}:${requestId}`]);
    const rows = await manager.query(`SELECT actor_id,kind,payload_hash,result FROM operation_receipts WHERE request_id=$1`, [requestId]);
    if (rows.length) {
      const previous = rows[0];
      if (previous.actor_id !== actor || previous.kind !== kind || previous.payload_hash !== hash) throw new ConflictException('Tento pokus již patří jinému úkonu. Obnov přehled.');
      return previous.result as T;
    }
    const result = await execute();
    await manager.query(`INSERT INTO operation_receipts(tenant_id,request_id,actor_id,kind,payload_hash,result) VALUES($1,$2,$3,$4,$5,$6)`, [this.context.tenantId,requestId,actor,kind,hash,JSON.stringify(result)]);
    return result;
  }
}
