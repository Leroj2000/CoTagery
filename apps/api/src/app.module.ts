import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './core/database/database.module';
import { RedisModule } from './core/redis/redis.module';
import { StorageModule } from './core/storage/storage.module';
import { AuthModule } from './core/auth/auth.module';
import { TenancyModule } from './core/tenancy/tenancy.module';
import { DomainModule } from './core/domain/domain.module';
import { ResolverModule } from './core/resolver/resolver.module';
import { AnalyticsModule } from './core/analytics/analytics.module';
import { AccessControlModule } from './core/access/access-control.module';
import { RbacModule } from './core/rbac/rbac.module';
import { FabricationModule } from './core/fabrication/fabrication.module';
import { ProductModule } from './modules/product/product.module';
import { TicketingModule } from './modules/ticketing/ticketing.module';
import { RentalModule } from './modules/rental/rental.module';
import { GalleryModule } from './modules/gallery/gallery.module';
import { MembershipModule } from './modules/membership/membership.module';
import { BillingModule } from './modules/billing/billing.module';
import { AssetModule } from './modules/asset/asset.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Lokálně čte .env z kořene monorepa; v produkci má přednost reálné env (Docker).
      envFilePath: ['../../.env', '.env'],
      validate: validateEnv,
    }),
    DatabaseModule,
    RedisModule,
    StorageModule,
    AuthModule,
    TenancyModule,
    DomainModule,
    ResolverModule,
    AnalyticsModule,
    AccessControlModule,
    RbacModule,
    FabricationModule,
    ProductModule,
    TicketingModule,
    RentalModule,
    GalleryModule,
    MembershipModule,
    BillingModule,
    AssetModule,
    InventoryModule,
    HealthModule,
  ],
})
export class AppModule {}
