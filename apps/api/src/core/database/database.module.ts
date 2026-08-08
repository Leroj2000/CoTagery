import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        // Runtime používá APP_DATABASE_URL (RLS role); fallback DATABASE_URL.
        url: config.get<string>('APP_DATABASE_URL') ?? config.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: false,
        migrationsRun: false,
      }),
    }),
  ],
})
export class DatabaseModule {}
