import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TenantContextService } from './tenant-context.service';
import { TenantTransactionInterceptor } from './tenant-transaction.interceptor';

@Global()
@Module({
  providers: [
    TenantContextService,
    { provide: APP_INTERCEPTOR, useClass: TenantTransactionInterceptor },
  ],
  exports: [TenantContextService],
})
export class TenancyModule {}
