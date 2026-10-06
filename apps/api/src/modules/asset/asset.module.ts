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
import { AssetObservation } from './entities/asset-observation.entity';
import { Tenant } from '../../core/domain/entities/tenant.entity';
import { AssetService } from './asset.service';
import { CategoriesService } from './categories.service';
import { MaintenanceService } from './maintenance.service';
import { MediaService } from './media.service';
import { ManualsService } from './manuals.service';
import { ManualFetchService } from './manual-fetch.service';
import { ManualCallbackService } from './manual-callback.service';
import { SpecsService } from './specs.service';
import { SpecCallbackService } from './spec-callback.service';
import { AssetController } from './asset.controller';
import { ScanController } from './scan.controller';
import { ReservationsController } from './reservations.controller';
import { CategoriesController } from './categories.controller';
import { MaintenanceController } from './maintenance.controller';
import { MediaController } from './media.controller';
import { ManualsController } from './manuals.controller';
import { ManualCallbackController } from './manual-callback.controller';
import { SpecsController } from './specs.controller';
import { SpecCallbackController } from './spec-callback.controller';
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
      AssetObservation,
      Tenant,
    ]),
    DomainModule,
  ],
  controllers: [
    RegistrationController,
    PersonalWorkflowsController,
    AssetController,
    ScanController,
    ReservationsController,
    CategoriesController,
    MaintenanceController,
    MediaController,
    ManualsController,
    ManualCallbackController,
    SpecsController,
    SpecCallbackController,
  ],
  providers: [
    AssetService,
    CategoriesService,
    MaintenanceService,
    MediaService,
    ManualsService,
    ManualFetchService,
    ManualCallbackService,
    SpecsService,
    SpecCallbackService,
    AssetHandler,
  ],
  exports: [AssetService],
})
export class AssetModule {}
