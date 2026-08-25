import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DomainModule } from '../../core/domain/domain.module';
import { Asset } from './entities/asset.entity';
import { Movement } from './entities/movement.entity';
import { ServiceRecord } from './entities/service-record.entity';
import { Reservation } from './entities/reservation.entity';
import { Category } from './entities/category.entity';
import { Issue } from './entities/issue.entity';
import { AssetMedia } from './entities/asset-media.entity';
import { AssetPhoto } from './entities/asset-photo.entity';
import { AssetManual } from './entities/asset-manual.entity';
import { AssetObservation } from './entities/asset-observation.entity';
import { Tenant } from '../../core/domain/entities/tenant.entity';
import { AssetService } from './asset.service';
import { CategoriesService } from './categories.service';
import { MediaService } from './media.service';
import { ManualsService } from './manuals.service';
import { ManualFetchService } from './manual-fetch.service';
import { ManualCallbackService } from './manual-callback.service';
import { AssetController } from './asset.controller';
import { ScanController } from './scan.controller';
import { ReservationsController } from './reservations.controller';
import { CategoriesController } from './categories.controller';
import { MediaController } from './media.controller';
import { ManualsController } from './manuals.controller';
import { ManualCallbackController } from './manual-callback.controller';
import { AssetHandler } from './asset.handler';

/**
 * Asset custody modul (Fáze A – „srdce"): asset s digitální identitou nad
 * DigitalObject, append-only Movement ledger a odvozený stav. Výpůjčka je zde
 * jen `Movement type=loan`. Registruje scan handler (DomainModule).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Asset,
      Movement,
      ServiceRecord,
      Reservation,
      Category,
      Issue,
      AssetMedia,
      AssetPhoto,
      AssetManual,
      AssetObservation,
      Tenant,
    ]),
    DomainModule,
  ],
  controllers: [
    AssetController,
    ScanController,
    ReservationsController,
    CategoriesController,
    MediaController,
    ManualsController,
    ManualCallbackController,
  ],
  providers: [
    AssetService,
    CategoriesService,
    MediaService,
    ManualsService,
    ManualFetchService,
    ManualCallbackService,
    AssetHandler,
  ],
  exports: [AssetService],
})
export class AssetModule {}
