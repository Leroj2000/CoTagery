import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type Redis from 'ioredis';
import type { HealthStatus } from '@tagery/shared';
import { REDIS } from '../core/redis/redis.module';

@Injectable()
export class HealthService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async check(): Promise<HealthStatus> {
    const [database, redis] = await Promise.all([this.pingDatabase(), this.pingRedis()]);
    const ok = database === 'up' && redis === 'up';
    return {
      status: ok ? 'ok' : 'degraded',
      uptimeSeconds: Math.round(process.uptime()),
      checks: { database, redis },
      timestamp: new Date().toISOString(),
    };
  }

  private async pingDatabase(): Promise<'up' | 'down'> {
    try {
      await this.dataSource.query('SELECT 1');
      return 'up';
    } catch {
      return 'down';
    }
  }

  private async pingRedis(): Promise<'up' | 'down'> {
    try {
      const res = await this.redis.ping();
      return res === 'PONG' ? 'up' : 'down';
    } catch {
      return 'down';
    }
  }
}
