import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TenantContextService } from './tenant-context.service';
import { TenantTransactionInterceptor } from './tenant-transaction.interceptor';
import { OperationReceiptsService } from './operation-receipts.service';

@Global()
@Module({
  providers: [
    TenantContextService,
    OperationReceiptsService,
    { provide: APP_INTERCEPTOR, useClass: TenantTransactionInterceptor },
  ],
  exports: [TenantContextService, OperationReceiptsService],
})
export class TenancyModule {}
