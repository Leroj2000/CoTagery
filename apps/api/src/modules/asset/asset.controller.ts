import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { RolesGuard, RequireRole } from '../../core/rbac/roles.guard';
import { AssetService } from './asset.service';
import {
  AddServiceDto,
  BulkMovementDto,
  CreateAssetDto,
  ImportCsvDto,
  PerformMovementDto,
  PutIntoContainerDto,
} from './dto/asset.dto';
import type { Asset } from './entities/asset.entity';
import type { Movement } from './entities/movement.entity';
import type { ServiceRecord } from './entities/service-record.entity';
import type { MovementType } from './movement.logic';

/** Minimální tvar nahraného souboru (bez závislosti na typech express/multer). */
interface UploadedFileLike {
  buffer: Buffer;
  mimetype: string;
}

@Controller('assets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssetController {
  constructor(private readonly assets: AssetService) {}

  @Get()
  list(): Promise<Asset[]> {
    return this.assets.list();
  }

  @Post()
  @RequireRole('EDITOR')
  create(@Body() dto: CreateAssetDto): Promise<Asset> {
    return this.assets.create(dto);
  }

  // --- CSV export / import (musí být před :id kvůli route matchingu) ---
  @Get('export')
  @Header('content-type', 'text/csv; charset=utf-8')
  @Header('content-disposition', 'attachment; filename="veci.csv"')
  async exportCsv(): Promise<string> {
    return this.assets.exportCsv();
  }

  @Post('import')
  @RequireRole('EDITOR')
  importCsv(
    @Body() dto: ImportCsvDto,
  ): Promise<{ created: number; failed: { row: number; error: string }[] }> {
    return this.assets.importCsv(dto.csv);
  }

  // --- Hromadný výdej ---
  @Post('movements/bulk')
  @RequireRole('EDITOR')
  bulk(
    @Body() dto: BulkMovementDto,
  ): Promise<{ ok: number; failed: { assetId: string; error: string }[] }> {
    const { assetIds, ...movement } = dto;
    return this.assets.bulkMovement(assetIds, movement);
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<Asset & { actions: MovementType[] }> {
    const asset = await this.assets.get(id);
    return { ...asset, actions: this.assets.actionsFor(asset) };
  }

  @Get(':id/movements')
  movements(@Param('id', ParseUUIDPipe) id: string): Promise<Movement[]> {
    return this.assets.listMovements(id);
  }

  @Post(':id/movements')
  @RequireRole('EDITOR')
  perform(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PerformMovementDto,
  ): Promise<Asset> {
    return this.assets.performMovement(id, dto);
  }

  // --- Asset nesting (§14) ---
  @Get(':id/contents')
  contents(@Param('id', ParseUUIDPipe) id: string): Promise<Asset[]> {
    return this.assets.listContents(id);
  }

  @Post(':id/contents')
  @RequireRole('EDITOR')
  putInto(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PutIntoContainerDto,
  ): Promise<Asset> {
    return this.assets.putInto(id, dto.childAssetId);
  }

  @Delete('contents/:childId')
  @RequireRole('EDITOR')
  @HttpCode(200)
  removeFromContainer(@Param('childId', ParseUUIDPipe) childId: string): Promise<Asset> {
    return this.assets.removeFromContainer(childId);
  }

  // --- Potvrzení převzetí (§8) ---
  @Get('movements/pending')
  pendingConfirmations(): Promise<Movement[]> {
    return this.assets.pendingConfirmations();
  }

  @Post('movements/:movementId/confirm')
  @RequireRole('EDITOR')
  confirmMovement(@Param('movementId', ParseUUIDPipe) movementId: string): Promise<Movement> {
    return this.assets.confirmMovement(movementId);
  }

  // --- Servis / revize (§17) ---
  @Get('services/due')
  dueServices(): Promise<ServiceRecord[]> {
    return this.assets.dueServices(30);
  }

  @Get(':id/services')
  services(@Param('id', ParseUUIDPipe) id: string): Promise<ServiceRecord[]> {
    return this.assets.listServices(id);
  }

  @Post(':id/services')
  @RequireRole('EDITOR')
  addService(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddServiceDto,
  ): Promise<ServiceRecord> {
    return this.assets.addService(id, dto);
  }

  // --- Fotografie věci ---
  @Post(':id/photo')
  @RequireRole('EDITOR')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file?: UploadedFileLike,
  ): Promise<Asset> {
    if (!file) throw new BadRequestException('Chybí soubor (pole "file")');
    return this.assets.setPhoto(id, file.buffer, file.mimetype);
  }

  @Get(':id/photo')
  async photo(@Param('id', ParseUUIDPipe) id: string): Promise<StreamableFile> {
    const { buffer, mime } = await this.assets.getPhoto(id);
    return new StreamableFile(buffer, { type: mime });
  }
}
