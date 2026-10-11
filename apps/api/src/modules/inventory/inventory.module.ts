import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DomainModule } from '../../core/domain/domain.module';
import { AssetModule } from '../asset/asset.module';
import { Asset } from '../asset/entities/asset.entity';
import { DataCarrier } from '../../core/domain/entities/data-carrier.entity';
import { InventoryCheck } from './entities/inventory-check.entity';
import { InventoryScan } from './entities/inventory-scan.entity';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { VehicleInventoryService } from './vehicle-inventory.service';
import { InventoryExportService } from './inventory-export.service';

/**
 * Inventura (Fáze C): porovnání evidence s realitou – nalezeno/chybí/navíc.
 * Staví na Asset custody (Fáze A): očekávané = assety přiřazené lokaci.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([InventoryCheck, InventoryScan, Asset, DataCarrier]),
    DomainModule,
    AssetModule,
  ],
  controllers: [InventoryController],
  providers: [InventoryService, VehicleInventoryService, InventoryExportService],
})
export class InventoryModule {}
