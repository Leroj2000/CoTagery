import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './core/database/database.module';
import { RedisModule } from './core/redis/redis.module';
import { StorageModule } from './core/storage/storage.module';
import { AuthModule } from './core/auth/auth.module';
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
    HealthModule,
  ],
})
export class AppModule {}
