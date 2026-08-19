import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../rbac/permissions.guard';
import { RequirePermission } from '../../rbac/require-permission.decorator';
import { DataCarriersService } from './data-carriers.service';
import { QrService } from './qr.service';
import { ClaimCarrierDto, GenerateBatchDto, NfcPairDto } from './dto/carrier.dto';
import type { DataCarrier } from '../entities/data-carrier.entity';

@Controller('carriers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DataCarriersController {
  constructor(
    private readonly carriers: DataCarriersService,
    private readonly qr: QrService,
  ) {}

  // Předgenerovaný pool – statické routy PŘED ":id".
  @Post('batch')
  @RequirePermission('carrier.item.manage')
  async generateBatch(@Body() dto: GenerateBatchDto): Promise<
    Array<{ id: string; publicCode: string; resolverUrl: string | null; status: string; pin: string | null }>
  > {
    const generated = await this.carriers.generateBatch(dto);
    return generated.map((g) => ({
      id: g.carrier.id,
      publicCode: g.carrier.publicCode,
      resolverUrl: g.carrier.resolverUrl,
      status: g.carrier.status,
      pin: g.pin, // jen teď – k tisku
    }));
  }

  @Get('unassigned')
  listUnassigned(): Promise<DataCarrier[]> {
    return this.carriers.listUnassigned();
  }

  /** ID objektů s přiřazeným identifikátorem – pro UI upozornění „věc bez identifikátoru". */
  @Get('assigned-object-ids')
  assignedObjectIds(): Promise<string[]> {
    return this.carriers.assignedObjectIds();
  }

  @Post('claim')
  @RequirePermission('carrier.item.manage')
  claim(@Body() dto: ClaimCarrierDto): Promise<DataCarrier> {
    return this.carriers.claim(dto.publicCode, dto.objectId);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<DataCarrier> {
    return this.carriers.get(id);
  }

  @Get(':id/qr')
  async qrImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('format') format?: string,
  ): Promise<StreamableFile> {
    const carrier = await this.carriers.get(id);
    const data = carrier.resolverUrl ?? carrier.publicCode;
    if (format === 'png') {
      return new StreamableFile(await this.qr.png(data), { type: 'image/png' });
    }
    const svg = await this.qr.svg(data);
    return new StreamableFile(Buffer.from(svg, 'utf8'), { type: 'image/svg+xml' });
  }

  @Post(':id/nfc/pair')
  @RequirePermission('carrier.item.manage')
  pairNfc(@Param('id', ParseUUIDPipe) id: string, @Body() dto: NfcPairDto): Promise<DataCarrier> {
    return this.carriers.pairNfc(id, dto);
  }
}
