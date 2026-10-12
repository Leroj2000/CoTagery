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
  Put,
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
import { isAllowedManualMime, MANUAL_MAX_BYTES } from './manuals.logic';
import {
  PurchaseService,
  type ExpiringWarranty,
  type PurchaseView,
  type WarrantyView,
} from './purchase.service';
import { UploadDocumentDto, UpsertPurchaseDto, WarrantyDto } from './dto/purchase.dto';
import type { AssetDocument } from './entities/asset-document.entity';
import { RequireModule } from '../../core/rbac/require-module.decorator';

/** Doklady: PDF nebo obrázek (fotka záručního listu), stejná pravidla jako manuály. */
function documentFileFilter(
  _req: unknown,
  file: { mimetype: string },
  callback: (error: Error | null, acceptFile: boolean) => void,
): void {
  if (!isAllowedManualMime(file.mimetype)) {
    callback(new BadRequestException('Nepodporovaný typ souboru (povoleno PDF a obrázky)'), false);
    return;
  }
  callback(null, true);
}

/** Pořízení (ceny, dodavatel), doklady a záruky položky. */
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequireModule('purchase')
export class PurchaseController {
  constructor(private readonly purchases: PurchaseService) {}

  // --- Záruky napříč položkami (pro „Vyžaduje pozornost") ---
  @Get('warranties/expiring')
  @RequirePermission('asset.item.view')
  expiring(@Query('days') days?: string): Promise<ExpiringWarranty[]> {
    const n = Number(days);
    return this.purchases.expiring(Number.isFinite(n) && n >= 0 && n <= 365 ? n : undefined);
  }

  // --- Pořízení ---
  @Get('assets/:id/purchase')
  @RequirePermission('asset.purchase.view')
  purchase(@Param('id', ParseUUIDPipe) id: string): Promise<PurchaseView> {
    return this.purchases.purchase(id);
  }

  @Put('assets/:id/purchase')
  @RequirePermission('asset.purchase.update')
  upsert(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertPurchaseDto,
  ): Promise<PurchaseView> {
    return this.purchases.upsertPurchase(id, dto);
  }

  // --- Doklady ---
  @Post('assets/:id/documents')
  @RequirePermission('asset.purchase.update')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MANUAL_MAX_BYTES },
      fileFilter: documentFileFilter,
    }),
  )
  upload(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UploadDocumentDto,
    @CurrentUser() user: RequestUser | undefined,
    @UploadedFile() file?: { buffer: Buffer; mimetype: string; originalname?: string },
  ): Promise<AssetDocument> {
    if (!file) throw new BadRequestException('Chybí soubor (pole "file")');
    return this.purchases.uploadDocument(id, dto.docType, file, user?.userId);
  }

  @Get('documents/:documentId/file')
  @RequirePermission('asset.item.view')
  async file(
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @CurrentUser() user: RequestUser,
  ): Promise<StreamableFile> {
    const { buffer, mime, fileName } = await this.purchases.documentFile(documentId, user);
    return new StreamableFile(buffer, {
      type: mime,
      disposition: `inline; filename*=UTF-8''${encodeURIComponent(fileName ?? 'doklad')}`,
    });
  }

  @Delete('documents/:documentId')
  @RequirePermission('asset.purchase.update')
  @HttpCode(204)
  hide(@Param('documentId', ParseUUIDPipe) documentId: string): Promise<void> {
    return this.purchases.hideDocument(documentId);
  }

  // --- Záruky ---
  @Get('assets/:id/warranties')
  @RequirePermission('asset.item.view')
  warranties(@Param('id', ParseUUIDPipe) id: string): Promise<WarrantyView[]> {
    return this.purchases.warranties(id);
  }

  @Post('assets/:id/warranties')
  @RequirePermission('asset.purchase.update')
  createWarranty(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: WarrantyDto,
  ): Promise<WarrantyView> {
    return this.purchases.createWarranty(id, dto);
  }

  @Put('warranties/:warrantyId')
  @RequirePermission('asset.purchase.update')
  updateWarranty(
    @Param('warrantyId', ParseUUIDPipe) warrantyId: string,
    @Body() dto: WarrantyDto,
  ): Promise<WarrantyView> {
    return this.purchases.updateWarranty(warrantyId, dto);
  }

  @Delete('warranties/:warrantyId')
  @RequirePermission('asset.purchase.update')
  @HttpCode(204)
  deleteWarranty(@Param('warrantyId', ParseUUIDPipe) warrantyId: string): Promise<void> {
    return this.purchases.deleteWarranty(warrantyId);
  }
}
