import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard, type RequestUser } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/rbac/permissions.guard';
import { RequirePermission } from '../../core/rbac/require-permission.decorator';
import { CurrentUser } from '../../core/auth/decorators';
import { IMPORT_MAX_BYTES } from './asset-io.logic';
import {
  AssetIoService,
  type ImportResult,
  type TransferFile,
  type TransferFormat,
} from './asset-io.service';

function format(raw: string | undefined): TransferFormat {
  return raw === 'csv' ? 'csv' : 'xlsx';
}

function download(file: TransferFile): StreamableFile {
  return new StreamableFile(file.buffer, {
    type: file.mime,
    disposition: `attachment; filename="${file.fileName}"`,
  });
}

/**
 * Hromadný export/import položek (Excel .xlsx, CSV). Registrovaný před
 * AssetController, aby `assets/export` nespadlo do `assets/:id`.
 */
@Controller('assets')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AssetIoController {
  constructor(private readonly io: AssetIoService) {}

  @Get('export')
  @RequirePermission('asset.item.view')
  async export(
    @CurrentUser() user: RequestUser,
    @Query('format') fmt?: string,
  ): Promise<StreamableFile> {
    return download(await this.io.export(user, format(fmt)));
  }

  @Get('import-template')
  @RequirePermission('asset.item.create')
  async template(
    @CurrentUser() user: RequestUser,
    @Query('format') fmt?: string,
  ): Promise<StreamableFile> {
    return download(await this.io.template(user, format(fmt)));
  }

  /** `dryRun` je výchozí (náhled); zapisuje se jen s `dryRun=0`. */
  @Post('import')
  @RequirePermission('asset.item.create')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: IMPORT_MAX_BYTES } }))
  import(
    @CurrentUser() user: RequestUser,
    @Query('dryRun') dryRun?: string,
    @UploadedFile() file?: { buffer: Buffer; originalname?: string },
  ): Promise<ImportResult> {
    if (!file) throw new BadRequestException('Chybí soubor (pole "file")');
    const apply = dryRun === '0' || dryRun === 'false';
    return this.io.import(user, file.buffer, !apply, file.originalname);
  }
}
