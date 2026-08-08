import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS } from '../redis/redis.module';
import type { Resolution } from './resolution';

/**
 * Cache mapování public_code → Resolution (ADR-0002 hot path).
 * Krátké TTL; invalidace při změně objektu/nosiče je plánované vylepšení.
 */
@Injectable()
export class ResolverCacheService {
  private static readonly TTL_SECONDS = 20;

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  private key(code: string): string {
    return `resolve:${code}`;
  }

  async read(code: string): Promise<Resolution | null> {
    const raw = await this.redis.get(this.key(code));
    return raw ? (JSON.parse(raw) as Resolution) : null;
  }

  async write(code: string, resolution: Resolution): Promise<void> {
    await this.redis.set(
      this.key(code),
      JSON.stringify(resolution),
      'EX',
      ResolverCacheService.TTL_SECONDS,
    );
  }

  async invalidate(code: string): Promise<void> {
    await this.redis.del(this.key(code));
  }
}
