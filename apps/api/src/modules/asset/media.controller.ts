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
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { JwtAuthGuard, type RequestUser } from '../../core/auth/jwt-auth.guard';
import { RolesGuard, RequireRole } from '../../core/rbac/roles.guard';
import { CurrentUser } from '../../core/auth/decorators';
import { MediaService } from './media.service';
import type { AssetMedia } from './entities/asset-media.entity';

interface UploadedFileLike {
  buffer: Buffer;
  mimetype: string;
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
  constructor(private readonly media: MediaService) {}

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
