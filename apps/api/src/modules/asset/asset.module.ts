import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DomainModule } from '../../core/domain/domain.module';
import { Asset } from './entities/asset.entity';
import { Movement } from './entities/movement.entity';
import { ServiceRecord } from './entities/service-record.entity';
import { Reservation } from './entities/reservation.entity';
import { Category } from './entities/category.entity';
import { Issue } from './entities/issue.entity';
import { AssetService } from './asset.service';
import { CategoriesService } from './categories.service';
import { AssetController } from './asset.controller';
import { ReservationsController } from './reservations.controller';
import { CategoriesController } from './categories.controller';
import { AssetHandler } from './asset.handler';

/**
 * Asset custody modul (Fáze A – „srdce"): asset s digitální identitou nad
 * DigitalObject, append-only Movement ledger a odvozený stav. Výpůjčka je zde
 * jen `Movement type=loan`. Registruje scan handler (DomainModule).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Asset, Movement, ServiceRecord, Reservation, Category, Issue]),
    DomainModule,
  ],
  controllers: [AssetController, ReservationsController, CategoriesController],
  providers: [AssetService, CategoriesService, AssetHandler],
  exports: [AssetService],
})
export class AssetModule {}
