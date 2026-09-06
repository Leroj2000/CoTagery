import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const production = config.get<string>('NODE_ENV') === 'production';
        const appUrl = config.get<string>('APP_DATABASE_URL');
        if (production && !appUrl) {
          throw new Error('APP_DATABASE_URL je v produkci povinné');
        }
        return {
          type: 'postgres' as const,
          // Vývoj může použít vlastnické spojení; produkční validace fallback zakazuje.
          url: appUrl ?? config.get<string>('DATABASE_URL'),
          autoLoadEntities: true,
          synchronize: false,
          migrationsRun: false,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
