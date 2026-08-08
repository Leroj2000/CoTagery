import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DomainModule } from '../../core/domain/domain.module';
import { GalleryEvent } from './entities/gallery-event.entity';
import { UploadItem } from './entities/upload-item.entity';
import { GalleryService } from './gallery.service';
import { GalleryController } from './gallery.controller';
import { GalleryHandler } from './gallery.handler';

/** EPIC-11 Gallery – sdílené galerie, upload přes StoragePort, handleScan. */
@Module({
  imports: [TypeOrmModule.forFeature([GalleryEvent, UploadItem]), DomainModule],
  controllers: [GalleryController],
  providers: [GalleryService, GalleryHandler],
})
export class GalleryModule {}
