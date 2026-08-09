import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataCarrier } from '../domain/entities/data-carrier.entity';
import { FabricationService } from './fabrication.service';
import { FabricationController } from './fabrication.controller';

/** EPIC-02 Fabrication (větev A): export nosiče do tiskových souborů. */
@Module({
  imports: [TypeOrmModule.forFeature([DataCarrier])],
  controllers: [FabricationController],
  providers: [FabricationService],
})
export class FabricationModule {}
