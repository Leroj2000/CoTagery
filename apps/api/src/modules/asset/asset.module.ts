import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DomainModule } from '../../core/domain/domain.module';
import { Asset } from './entities/asset.entity';
import { Movement } from './entities/movement.entity';
import { ServiceRecord } from './entities/service-record.entity';
import { MeterReading } from './entities/meter-reading.entity';
import { MaintenanceRule } from './entities/maintenance-rule.entity';
import { Reservation } from './entities/reservation.entity';
import { Category } from './entities/category.entity';
import { Issue } from './entities/issue.entity';
import { AssetMedia } from './entities/asset-media.entity';
import { AssetPhoto } from './entities/asset-photo.entity';
import { AssetManual } from './entities/asset-manual.entity';
import { AssetSpec } from './entities/asset-spec.entity';
import { AssetTire } from './entities/asset-tire.entity';
import { AssetObservation } from './entities/asset-observation.entity';
import { AssetPurchase } from './entities/asset-purchase.entity';
import { AssetDocument } from './entities/asset-document.entity';
import { AssetWarranty } from './entities/asset-warranty.entity';
import { Tenant } from '../../core/domain/entities/tenant.entity';
import { AssetService } from './asset.service';
import { CategoriesService } from './categories.service';
import { MaintenanceService } from './maintenance.service';
import { AssetNotificationsService } from './asset-notifications.service';
import { MediaService } from './media.service';
import { ManualsService } from './manuals.service';
import { ManualFetchService } from './manual-fetch.service';
import { ManualCallbackService } from './manual-callback.service';
import { SpecsService } from './specs.service';
import { TiresService } from './tires.service';
import { SpecCallbackService } from './spec-callback.service';
import { PurchaseService } from './purchase.service';
import { AssetIoService } from './asset-io.service';
import { AssetController } from './asset.controller';
import { ScanController } from './scan.controller';
import { ReservationsController } from './reservations.controller';
import { CategoriesController } from './categories.controller';
import { MaintenanceController } from './maintenance.controller';
import { MediaController } from './media.controller';
import { ManualsController } from './manuals.controller';
import { ManualCallbackController } from './manual-callback.controller';
import { SpecsController } from './specs.controller';
import { TiresController } from './tires.controller';
import { SpecCallbackController } from './spec-callback.controller';
import { PurchaseController } from './purchase.controller';
import { AssetIoController } from './asset-io.controller';
import { AssetHandler } from './asset.handler';
import { RegistrationController } from './registration.controller';
import { PersonalWorkflowsController } from './personal-workflows.controller';

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
      MeterReading,
      MaintenanceRule,
      Reservation,
      Category,
      Issue,
      AssetMedia,
      AssetPhoto,
      AssetManual,
      AssetSpec,
      AssetTire,
      AssetObservation,
      AssetPurchase,
      AssetDocument,
      AssetWarranty,
      Tenant,
    ]),
    DomainModule,
  ],
  controllers: [
    RegistrationController,
    PersonalWorkflowsController,
    AssetIoController,
    AssetController,
    ScanController,
    ReservationsController,
    CategoriesController,
    MaintenanceController,
    MediaController,
    ManualsController,
    ManualCallbackController,
    SpecsController,
    TiresController,
    SpecCallbackController,
    PurchaseController,
  ],
  providers: [
    AssetService,
    CategoriesService,
    MaintenanceService,
    AssetNotificationsService,
    MediaService,
    ManualsService,
    ManualFetchService,
    ManualCallbackService,
    SpecsService,
    TiresService,
    SpecCallbackService,
    PurchaseService,
    AssetIoService,
    AssetHandler,
  ],
  exports: [AssetService, MaintenanceService, TiresService],
})
export class AssetModule {}
