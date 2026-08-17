import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  StreamableFile,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { JwtAuthGuard, type RequestUser } from '../../core/auth/jwt-auth.guard';
import { RolesGuard, RequireRole } from '../../core/rbac/roles.guard';
import { CurrentUser } from '../../core/auth/decorators';
import { MediaService } from './media.service';
import { AssetService } from './asset.service';
import type { AssetMedia } from './entities/asset-media.entity';
import type { Asset } from './entities/asset.entity';

interface UploadedFileLike {
  buffer: Buffer;
  mimetype: string;
}

class ReturnWithPhotoDto {
  @IsOptional()
  @IsUUID()
  toId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

class AddMediaFieldsDto {
  @IsOptional()
  @IsUUID()
  movementId?: string;

  @IsOptional()
  @IsIn(['at_loan', 'at_return', 'at_service', 'general'])
  phase?: 'at_loan' | 'at_return' | 'at_service' | 'general';

  @IsOptional()
  @IsString()
  @MaxLength(300)
  caption?: string;
}

/** Časová galerie věci: upload/list (asset-scoped) + soubor/skrytí (media-scoped). */
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class MediaController {
  constructor(
    private readonly media: MediaService,
    private readonly assets: AssetService,
  ) {}

  /**
   * Vrácení věci s fotkou (atomicky). Podle politiky tenanta může být foto
   * povinné – když chybí a je vyžadováno, 400. Vytvoří return pohyb a naváže
   * na něj fotky s fází `at_return`.
   */
  @Post('assets/:id/return')
  @RequireRole('EDITOR')
  @UseInterceptors(FilesInterceptor('files', 10))
  async returnWithPhotos(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReturnWithPhotoDto,
    @CurrentUser() user: RequestUser | undefined,
    @UploadedFiles() files?: UploadedFileLike[],
  ): Promise<Asset> {
    const photos = files ?? [];
    if (photos.length === 0 && (await this.assets.requireReturnPhoto())) {
      throw new BadRequestException('Vrácení vyžaduje fotku stavu (politika tenanta)');
    }
    await this.assets.performMovement(
      id,
      { type: 'return', toId: dto.toId, note: dto.note },
      { skipReturnPhotoCheck: true },
    );
    const movementId = (await this.assets.lastMovementId(id)) ?? undefined;
    for (const f of photos) {
      await this.media.add(id, {
        buffer: f.buffer,
        mime: f.mimetype,
        movementId,
        phase: 'at_return',
        capturedBy: user?.userId,
      });
    }
    return this.assets.get(id);
  }

  @Get('assets/:id/media')
  list(@Param('id', ParseUUIDPipe) id: string): Promise<AssetMedia[]> {
    return this.media.list(id);
  }

  @Post('assets/:id/media')
  @RequireRole('EDITOR')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() fields: AddMediaFieldsDto,
    @CurrentUser() user: RequestUser | undefined,
    @UploadedFile() file?: UploadedFileLike,
  ): Promise<AssetMedia> {
    if (!file) throw new BadRequestException('Chybí soubor (pole "file")');
    return this.media.add(id, {
      buffer: file.buffer,
      mime: file.mimetype,
      movementId: fields.movementId,
      phase: fields.phase,
      caption: fields.caption,
      capturedBy: user?.userId,
    });
  }

  @Get('media/:mediaId/file')
  async file(@Param('mediaId', ParseUUIDPipe) mediaId: string): Promise<StreamableFile> {
    const { buffer, mime } = await this.media.file(mediaId);
    return new StreamableFile(buffer, { type: mime });
  }

  @Delete('media/:mediaId')
  @RequireRole('EDITOR')
  @HttpCode(204)
  hide(@Param('mediaId', ParseUUIDPipe) mediaId: string): Promise<void> {
    return this.media.hide(mediaId);
  }
}
