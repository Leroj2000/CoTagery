import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataCarrier } from '../domain/entities/data-carrier.entity';
import { FabricationService } from './fabrication.service';
import { FabricationController } from './fabrication.controller';
import { DomainModule } from '../domain/domain.module';
import { LabelTemplateEntity } from './label-template.entity';
import { LabelTemplatesService } from './label-templates.service';
import { LabelTemplatesController } from './label-templates.controller';

/** EPIC-02 Fabrication (větev A): export nosiče do tiskových souborů + šablony štítků. */
@Module({
  imports: [TypeOrmModule.forFeature([DataCarrier, LabelTemplateEntity]), DomainModule],
  controllers: [FabricationController, LabelTemplatesController],
  providers: [FabricationService, LabelTemplatesService],
})
export class FabricationModule {}
