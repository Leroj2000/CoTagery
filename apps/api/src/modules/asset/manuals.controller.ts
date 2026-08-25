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
import { IsIn, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/rbac/permissions.guard';
import { RequirePermission } from '../../core/rbac/require-permission.decorator';
import { ManualsService } from './manuals.service';
import type { AssetManual } from './entities/asset-manual.entity';

interface UploadedFileLike {
  buffer: Buffer;
  mimetype: string;
  originalname?: string;
}

class UploadManualDto {
  @IsOptional()
  @IsIn(['upload', 'camera'])
  source?: 'upload' | 'camera';
}

/** Odpověď fetch-ai: stav pro UI (zejména `configured`). */
interface FetchAiResponse {
  manualId: string | null;
  status: AssetManual['status'];
  configured: boolean;
}

/**
 * Manuály a návody k položce: upload souboru / fotka z kamery / spuštění AI
 * stažení. Vše tenant-scoped (RLS), soubory přes StoragePort. Endpointy pod
 * `/api/v1` (globální prefix).
 */
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ManualsController {
  constructor(private readonly manuals: ManualsService) {}

  @Get('assets/:id/manuals')
  @RequirePermission('asset.item.view')
  list(@Param('id', ParseUUIDPipe) id: string): Promise<AssetManual[]> {
    return this.manuals.list(id);
  }

  @Post('assets/:id/manuals')
  @RequirePermission('asset.media.manage')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UploadManualDto,
    @UploadedFile() file?: UploadedFileLike,
  ): Promise<AssetManual> {
    if (!file) throw new BadRequestException('Chybí soubor (pole "file")');
    return this.manuals.add(id, {
      buffer: file.buffer,
      mime: file.mimetype,
      filename: file.originalname,
      source: dto.source,
    });
  }

  @Post('assets/:id/manuals/fetch-ai')
  @RequirePermission('asset.media.manage')
  async fetchAi(@Param('id', ParseUUIDPipe) id: string): Promise<FetchAiResponse> {
    const res = await this.manuals.fetchAi(id);
    return {
      manualId: res.configured ? res.manual.id : null,
      status: res.manual.status,
      configured: res.configured,
    };
  }

  @Get('manuals/:manualId/file')
  @RequirePermission('asset.item.view')
  async file(
    @Param('manualId', ParseUUIDPipe) manualId: string,
  ): Promise<StreamableFile> {
    const { buffer, mime } = await this.manuals.file(manualId);
    return new StreamableFile(buffer, { type: mime });
  }

  @Delete('manuals/:manualId')
  @RequirePermission('asset.media.manage')
  @HttpCode(204)
  remove(@Param('manualId', ParseUUIDPipe) manualId: string): Promise<void> {
    return this.manuals.remove(manualId);
  }
}
