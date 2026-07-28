import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { STORAGE, type StoragePort } from './storage.port';
import { LocalStorageAdapter } from './local-storage.adapter';

@Global()
@Module({
  providers: [
    {
      provide: STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService): StoragePort => {
        const driver = config.get<string>('STORAGE_DRIVER') ?? 'local';
        switch (driver) {
          case 'local':
            return new LocalStorageAdapter(config.get<string>('STORAGE_LOCAL_PATH') ?? './.storage');
          case 'r2':
          case 's3':
            // Implementace R2/S3 adaptéru přijde s deploy EPICem (ADR-0008).
            throw new Error(`Storage driver '${driver}' zatím není implementován.`);
          default:
            throw new Error(`Neznámý STORAGE_DRIVER: ${driver}`);
        }
      },
    },
  ],
  exports: [STORAGE],
})
export class StorageModule {}
