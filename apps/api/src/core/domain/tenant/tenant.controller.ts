import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Patch,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../rbac/permissions.guard';
import { RequirePermission } from '../../rbac/require-permission.decorator';
import { TenantService, type TenantView } from './tenant.service';
import { UpdateTenantDto } from './dto/tenant.dto';

/** Logo: jen PNG, max 2 MB (upload limit + MIME allowlist; obsah ověří sharp). */
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

function pngOnlyFilter(
  _req: unknown,
  file: { mimetype: string },
  callback: (error: Error | null, acceptFile: boolean) => void,
): void {
  if (file.mimetype !== 'image/png') {
    callback(new BadRequestException('Logo musí být ve formátu PNG.'), false);
    return;
  }
  callback(null, true);
}

/** Nastavení aktuálního tenanta (EPIC-03). Změny jen ADMIN+. */
@Controller('tenant')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TenantController {
  constructor(private readonly tenant: TenantService) {}

  @Get()
  @RequirePermission('core.organization.view')
  current(): Promise<TenantView> {
    return this.tenant.view();
  }

  @Patch()
  @RequirePermission('core.organization.configure')
  update(@Body() dto: UpdateTenantDto): Promise<TenantView> {
    return this.tenant.update(dto);
  }

  // --- Logo firmy ---

  /**
   * PNG loga vlastní firmy. Gate `asset.item.view` (ne organization.view): logo
   * potřebuje každý, kdo tiskne štítky, jinak by se štítky lišily podle role.
   */
  @Get('logo')
  @RequirePermission('asset.item.view')
  async logo(): Promise<StreamableFile> {
    const logo = await this.tenant.logo();
    if (!logo) throw new NotFoundException('Firma nemá logo');
    return new StreamableFile(logo.buffer, { type: 'image/png' });
  }

  @Post('logo')
  @RequirePermission('core.organization.configure')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_LOGO_BYTES }, fileFilter: pngOnlyFilter }),
  )
  setLogo(@UploadedFile() file?: { buffer: Buffer }): Promise<TenantView> {
    if (!file) throw new BadRequestException('Chybí soubor (pole "file")');
    return this.tenant.setLogo(file.buffer);
  }

  @Delete('logo')
  @RequirePermission('core.organization.configure')
  deleteLogo(): Promise<TenantView> {
    return this.tenant.deleteLogo();
  }
}
