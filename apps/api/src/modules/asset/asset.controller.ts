import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  StreamableFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/rbac/permissions.guard';
import { RequirePermission } from '../../core/rbac/require-permission.decorator';
import { AssetService, type WorkflowValidation } from './asset.service';
import {
  AddServiceDto,
  BulkMovementDto,
  CreateAssetDto,
  ImportCsvDto,
  PerformMovementDto,
  PutIntoContainerDto,
  ReportIssueDto,
  UpdateAssetDto,
  WorkflowValidateDto,
} from './dto/asset.dto';
import type { Asset } from './entities/asset.entity';
import type { Movement } from './entities/movement.entity';
import type { ServiceRecord } from './entities/service-record.entity';
import type { Issue } from './entities/issue.entity';
import type { MovementType } from './movement.logic';

/** Minimální tvar nahraného souboru (bez závislosti na typech express/multer). */
interface UploadedFileLike {
  buffer: Buffer;
  mimetype: string;
}

@Controller('assets')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AssetController {
  constructor(private readonly assets: AssetService) {}

  @Get()
  @RequirePermission('asset.item.view')
  list(): Promise<Asset[]> {
    return this.assets.list();
  }

  @Post()
  @RequirePermission('asset.item.create')
  create(@Body() dto: CreateAssetDto): Promise<Asset> {
    return this.assets.create(dto);
  }

  // --- CSV export / import (musí být před :id kvůli route matchingu) ---
  @Get('export')
  @RequirePermission('asset.item.view')
  @Header('content-type', 'text/csv; charset=utf-8')
  @Header('content-disposition', 'attachment; filename="veci.csv"')
  async exportCsv(): Promise<string> {
    return this.assets.exportCsv();
  }

  @Post('import')
  @RequirePermission('asset.item.create')
  importCsv(
    @Body() dto: ImportCsvDto,
  ): Promise<{ created: number; failed: { row: number; error: string }[] }> {
    return this.assets.importCsv(dto.csv);
  }

  // --- Hromadný výdej ---
  @Post('movements/bulk')
  @RequirePermission('asset.dispatch.bulk')
  bulk(
    @Body() dto: BulkMovementDto,
  ): Promise<{ ok: number; failed: { assetId: string; error: string }[] }> {
    const { assetIds, ...movement } = dto;
    return this.assets.bulkMovement(assetIds, movement);
  }

  // --- Workflow Scanner: pre-flight validace (musí být před :id) ---
  @Post('workflow/validate')
  @RequirePermission('asset.movement.perform')
  validateWorkflow(@Body() dto: WorkflowValidateDto): Promise<WorkflowValidation> {
    return this.assets.validateWorkflow(dto);
  }

  // --- „Vyžaduje pozornost" (musí být před :id) ---
  @Get('attention')
  @RequirePermission('asset.item.view')
  attention(): Promise<{
    overdue: Asset[];
    pendingConfirmations: Movement[];
    openIssues: Issue[];
    dueServices: ServiceRecord[];
  }> {
    return this.assets.attention();
  }

  @Get(':id')
  @RequirePermission('asset.item.view')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<Asset & { actions: MovementType[] }> {
    const asset = await this.assets.get(id);
    return { ...asset, actions: this.assets.actionsFor(asset) };
  }

  @Patch(':id')
  @RequirePermission('asset.item.update')
  updateAsset(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssetDto,
  ): Promise<Asset> {
    return this.assets.update(id, dto);
  }

  @Get(':id/movements')
  @RequirePermission('asset.item.view')
  movements(@Param('id', ParseUUIDPipe) id: string): Promise<Movement[]> {
    return this.assets.listMovements(id);
  }

  /** Last Observation: kde/kdy byla věc naposledy VIDĚNA (samostatná vrstva). */
  @Get(':id/observations')
  @RequirePermission('asset.item.view')
  observations(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<
    { id: string; source: string; observedAt: string; locationName: string | null; actorName: string | null }[]
  > {
    return this.assets.listObservations(id);
  }

  @Post(':id/movements')
  @RequirePermission('asset.movement.perform')
  perform(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PerformMovementDto,
  ): Promise<Asset> {
    return this.assets.performMovement(id, dto);
  }

  // --- Asset nesting (§14) ---
  @Get(':id/contents')
  @RequirePermission('asset.item.view')
  contents(@Param('id', ParseUUIDPipe) id: string): Promise<Asset[]> {
    return this.assets.listContents(id);
  }

  @Post(':id/contents')
  @RequirePermission('asset.item.update')
  putInto(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PutIntoContainerDto,
  ): Promise<Asset> {
    return this.assets.putInto(id, dto.childAssetId);
  }

  @Delete('contents/:childId')
  @RequirePermission('asset.item.update')
  @HttpCode(200)
  removeFromContainer(@Param('childId', ParseUUIDPipe) childId: string): Promise<Asset> {
    return this.assets.removeFromContainer(childId);
  }

  // --- Potvrzení převzetí (§8) ---
  @Get('movements/pending')
  @RequirePermission('asset.item.view')
  pendingConfirmations(): Promise<Movement[]> {
    return this.assets.pendingConfirmations();
  }

  @Post('movements/:movementId/confirm')
  @RequirePermission('asset.movement.perform')
  confirmMovement(@Param('movementId', ParseUUIDPipe) movementId: string): Promise<Movement> {
    return this.assets.confirmMovement(movementId);
  }

  // --- Servis / revize (§17) ---
  @Get('services/due')
  @RequirePermission('asset.item.view')
  dueServices(): Promise<ServiceRecord[]> {
    return this.assets.dueServices(30);
  }

  @Get(':id/services')
  @RequirePermission('asset.item.view')
  services(@Param('id', ParseUUIDPipe) id: string): Promise<ServiceRecord[]> {
    return this.assets.listServices(id);
  }

  @Post(':id/services')
  @RequirePermission('asset.item.update')
  addService(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddServiceDto,
  ): Promise<ServiceRecord> {
    return this.assets.addService(id, dto);
  }

  // --- Fotografie věci (hlavní náhled) ---
  @Get(':id/photo')
  @RequirePermission('asset.item.view')
  async photo(@Param('id', ParseUUIDPipe) id: string): Promise<StreamableFile> {
    const { buffer, mime } = await this.assets.getPhoto(id);
    return new StreamableFile(buffer, { type: mime });
  }

  // --- Galerie fotek věci (více fotek, hlavní = pozice 0) ---
  @Get(':id/photos')
  @RequirePermission('asset.item.view')
  async photos(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ items: { id: string; mime: string; position: number }[]; max: number }> {
    const [list, max] = await Promise.all([this.assets.listPhotos(id), this.assets.photoLimit()]);
    return {
      items: list.map((p) => ({ id: p.id, mime: p.mime, position: p.position })),
      max,
    };
  }

  @Post(':id/photos')
  @RequirePermission('asset.media.manage')
  @UseInterceptors(FilesInterceptor('files', 10))
  async addPhotos(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files?: UploadedFileLike[],
  ): Promise<Asset> {
    const list = files ?? [];
    if (list.length === 0) throw new BadRequestException('Chybí soubor (pole "files")');
    for (const f of list) {
      await this.assets.addPhoto(id, f.buffer, f.mimetype);
    }
    return this.assets.get(id);
  }

  @Get(':id/photos/:photoId/file')
  @RequirePermission('asset.item.view')
  async photoFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
  ): Promise<StreamableFile> {
    const { buffer, mime } = await this.assets.getPhotoFile(id, photoId);
    return new StreamableFile(buffer, { type: mime });
  }

  @Post(':id/photos/:photoId/main')
  @RequirePermission('asset.media.manage')
  @HttpCode(204)
  setMainPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
  ): Promise<void> {
    return this.assets.setMainPhoto(id, photoId);
  }

  @Delete(':id/photos/:photoId')
  @RequirePermission('asset.media.manage')
  @HttpCode(204)
  deletePhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
  ): Promise<void> {
    return this.assets.deletePhoto(id, photoId);
  }

  // --- Nahlášení problému / poškození ---
  @Get(':id/issues')
  @RequirePermission('asset.item.view')
  issues(@Param('id', ParseUUIDPipe) id: string): Promise<Issue[]> {
    return this.assets.listIssues(id);
  }

  @Post(':id/issues')
  @RequirePermission('asset.issue.manage')
  reportIssue(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReportIssueDto,
  ): Promise<Issue> {
    return this.assets.reportIssue(id, dto);
  }

  @Post('issues/:issueId/resolve')
  @RequirePermission('asset.issue.manage')
  resolveIssue(@Param('issueId', ParseUUIDPipe) issueId: string): Promise<Issue> {
    return this.assets.resolveIssue(issueId);
  }
}
