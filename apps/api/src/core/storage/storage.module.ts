import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { STORAGE, type StoragePort } from './storage.port';
import { LocalStorageAdapter } from './local-storage.adapter';
import { TrackingStorage } from './tracking-storage';

@Global()
@Module({
  providers: [
    {
      provide: STORAGE,
      inject: [ConfigService, getDataSourceToken()],
      useFactory: (config: ConfigService, dataSource: DataSource): StoragePort => {
        const driver = config.get<string>('STORAGE_DRIVER') ?? 'local';
        let inner: StoragePort;
        switch (driver) {
          case 'local':
            inner = new LocalStorageAdapter(
              config.get<string>('STORAGE_LOCAL_PATH') ?? './.storage',
            );
            break;
          case 'r2':
          case 's3':
            // Implementace R2/S3 adaptéru přijde s deploy EPICem (ADR-0008).
            throw new Error(`Storage driver '${driver}' zatím není implementován.`);
          default:
            throw new Error(`Neznámý STORAGE_DRIVER: ${driver}`);
        }
        // Evidence velikostí souborů pro limit úložiště předplatného (EPIC-20).
        return new TrackingStorage(inner, dataSource);
      },
    },
  ],
  exports: [STORAGE],
})
export class StorageModule {}
