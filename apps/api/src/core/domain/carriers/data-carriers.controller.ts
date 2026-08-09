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
import { DataCarriersService } from './data-carriers.service';
import { QrService } from './qr.service';
import { ClaimCarrierDto, GenerateBatchDto, NfcPairDto } from './dto/carrier.dto';
import type { DataCarrier } from '../entities/data-carrier.entity';

@Controller('carriers')
@UseGuards(JwtAuthGuard)
export class DataCarriersController {
  constructor(
    private readonly carriers: DataCarriersService,
    private readonly qr: QrService,
  ) {}

  // Předgenerovaný pool – statické routy PŘED ":id".
  @Post('batch')
  generateBatch(@Body() dto: GenerateBatchDto): Promise<DataCarrier[]> {
    return this.carriers.generateBatch(dto.count, dto.carrierType ?? 'qr');
  }

  @Get('unassigned')
  listUnassigned(): Promise<DataCarrier[]> {
    return this.carriers.listUnassigned();
  }

  @Post('claim')
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
  pairNfc(@Param('id', ParseUUIDPipe) id: string, @Body() dto: NfcPairDto): Promise<DataCarrier> {
    return this.carriers.pairNfc(id, dto);
  }
}
