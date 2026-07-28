import { Global, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/** Injection token pro sdílený Redis klient (cache/fronty – ADR-0002). */
export const REDIS = Symbol('REDIS');

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis =>
        new Redis(config.get<string>('REDIS_URL')!, {
          maxRetriesPerRequest: 2,
          lazyConnect: false,
        }),
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnModuleDestroy {
  constructor() {}

  async onModuleDestroy(): Promise<void> {
    // Klient se uzavře při ukončení aplikace; explicitní cleanup lze doplnit později.
  }
}
