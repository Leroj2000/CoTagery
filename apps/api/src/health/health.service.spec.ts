import type { DataSource } from 'typeorm';
import type Redis from 'ioredis';
import { HealthService } from './health.service';

describe('HealthService', () => {
  it('vrací ok, když DB i Redis odpovídají', async () => {
    const dataSource = { query: jest.fn().mockResolvedValue([{ '?column?': 1 }]) } as unknown as DataSource;
    const redis = { ping: jest.fn().mockResolvedValue('PONG') } as unknown as Redis;

    const service = new HealthService(dataSource, redis);
    const result = await service.check();

    expect(result.status).toBe('ok');
    expect(result.checks).toEqual({ database: 'up', redis: 'up' });
    expect(typeof result.uptimeSeconds).toBe('number');
  });

  it('vrací degraded, když Redis nedostupný', async () => {
    const dataSource = { query: jest.fn().mockResolvedValue([]) } as unknown as DataSource;
    const redis = { ping: jest.fn().mockRejectedValue(new Error('down')) } as unknown as Redis;

    const service = new HealthService(dataSource, redis);
    const result = await service.check();

    expect(result.status).toBe('degraded');
    expect(result.checks.redis).toBe('down');
    expect(result.checks.database).toBe('up');
  });
});
