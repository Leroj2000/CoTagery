import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DomainModule } from '../../core/domain/domain.module';
import { Asset } from './entities/asset.entity';
import { Movement } from './entities/movement.entity';
import { ServiceRecord } from './entities/service-record.entity';
import { Reservation } from './entities/reservation.entity';
import { AssetService } from './asset.service';
import { AssetController } from './asset.controller';
import { ReservationsController } from './reservations.controller';
import { AssetHandler } from './asset.handler';

/**
 * Asset custody modul (Fáze A – „srdce"): asset s digitální identitou nad
 * DigitalObject, append-only Movement ledger a odvozený stav. Výpůjčka je zde
 * jen `Movement type=loan`. Registruje scan handler (DomainModule).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Asset, Movement, ServiceRecord, Reservation]),
    DomainModule,
  ],
  controllers: [AssetController, ReservationsController],
  providers: [AssetService, AssetHandler],
  exports: [AssetService],
})
export class AssetModule {}
