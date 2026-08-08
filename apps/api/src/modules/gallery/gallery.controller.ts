import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { GalleryService, type UploadedFileLike } from './gallery.service';
import { CreateGalleryDto } from './dto/create-gallery.dto';
import type { GalleryEvent } from './entities/gallery-event.entity';
import type { UploadItem } from './entities/upload-item.entity';

@Controller('galleries')
@UseGuards(JwtAuthGuard)
export class GalleryController {
  constructor(private readonly gallery: GalleryService) {}

  @Post()
  create(@Body() dto: CreateGalleryDto): Promise<GalleryEvent> {
    return this.gallery.createGallery(dto);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<GalleryEvent> {
    return this.gallery.get(id);
  }

  @Get(':id/uploads')
  listUploads(@Param('id', ParseUUIDPipe) id: string): Promise<UploadItem[]> {
    return this.gallery.listUploads(id);
  }

  @Post(':id/uploads')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file?: UploadedFileLike,
  ): Promise<UploadItem> {
    if (!file) throw new BadRequestException('Chybí soubor (pole "file")');
    return this.gallery.addUpload(id, file);
  }
}
