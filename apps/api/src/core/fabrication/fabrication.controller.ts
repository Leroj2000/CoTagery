import { Controller, Get, Param, ParseUUIDPipe, Query, StreamableFile, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FabricationService } from './fabrication.service';

@Controller('carriers')
@UseGuards(JwtAuthGuard)
export class FabricationController {
  constructor(private readonly fabrication: FabricationService) {}

  /** Tiskový štítek nosiče: SVG (default) | png | pdf. */
  @Get(':id/fabrication')
  async label(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('format') format?: string,
  ): Promise<StreamableFile> {
    const fmt = format === 'pdf' || format === 'png' ? format : 'svg';
    const out = await this.fabrication.label(id, fmt);
    return new StreamableFile(out.buffer, { type: out.contentType, disposition: `inline; filename="${out.filename}"` });
  }
}
