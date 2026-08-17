import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FoundReport } from './entities/found-report.entity';
import { FoundService } from './found.service';
import { FoundPublicController, FoundReportsController } from './found.controller';

/** Nahlášení nálezu (§33) – veřejné (bez loginu) + majitelský přehled. */
@Module({
  imports: [TypeOrmModule.forFeature([FoundReport])],
  controllers: [FoundPublicController, FoundReportsController],
  providers: [FoundService],
})
export class FoundModule {}
