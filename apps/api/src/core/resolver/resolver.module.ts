import { Global, Module } from '@nestjs/common';
import { DomainModule } from '../domain/domain.module';
import { ResolverController } from './resolver.controller';
import { ResolverService } from './resolver.service';
import { ResolverCacheService } from './resolver-cache.service';
import { RateLimitService } from './rate-limit.service';
import { ScanLoggerService } from './scan-logger.service';

@Global()
@Module({
  imports: [DomainModule],
  controllers: [ResolverController],
  providers: [ResolverService, ResolverCacheService, RateLimitService, ScanLoggerService],
  exports: [ResolverCacheService],
})
export class ResolverModule {}
