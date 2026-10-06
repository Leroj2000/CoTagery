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
import { PermissionsGuard } from '../../core/rbac/permissions.guard';
import { AllowAuthenticatedOnly, RequirePermission } from '../../core/rbac/require-permission.decorator';
import { RequireModule } from '../../core/rbac/require-module.decorator';
import { GalleryService, type UploadedFileLike } from './gallery.service';
import { CreateGalleryDto } from './dto/create-gallery.dto';
import type { GalleryEvent } from './entities/gallery-event.entity';
import type { UploadItem } from './entities/upload-item.entity';

/** Upload do galerie (foto/video z akce): max 20 MB na soubor. */
const MAX_GALLERY_UPLOAD_BYTES = 20 * 1024 * 1024;

function imageOrVideoFilter(
  _req: unknown,
  file: { mimetype: string },
  callback: (error: Error | null, acceptFile: boolean) => void,
): void {
  if (!file.mimetype.startsWith('image/') && !file.mimetype.startsWith('video/')) {
    callback(new BadRequestException('Nepodporovaný typ souboru (povoleny jen obrázky a video)'), false);
    return;
  }
  callback(null, true);
}

@Controller('galleries')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequireModule('gallery')
export class GalleryController {
  constructor(private readonly gallery: GalleryService) {}

  @Post()
  @RequirePermission('gallery.item.manage')
  create(@Body() dto: CreateGalleryDto): Promise<GalleryEvent> {
    return this.gallery.createGallery(dto);
  }

  @Get(':id')
  @AllowAuthenticatedOnly()
  get(@Param('id', ParseUUIDPipe) id: string): Promise<GalleryEvent> {
    return this.gallery.get(id);
  }

  @Get(':id/uploads')
  @AllowAuthenticatedOnly()
  listUploads(@Param('id', ParseUUIDPipe) id: string): Promise<UploadItem[]> {
    return this.gallery.listUploads(id);
  }

  @Post(':id/uploads')
  @RequirePermission('gallery.item.manage')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_GALLERY_UPLOAD_BYTES },
      fileFilter: imageOrVideoFilter,
    }),
  )
  upload(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file?: UploadedFileLike,
  ): Promise<UploadItem> {
    if (!file) throw new BadRequestException('Chybí soubor (pole "file")');
    return this.gallery.addUpload(id, file);
  }
}
