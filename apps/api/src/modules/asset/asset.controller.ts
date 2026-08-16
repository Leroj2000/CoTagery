import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { RolesGuard, RequireRole } from '../../core/rbac/roles.guard';
import { AssetService } from './asset.service';
import { CreateAssetDto, PerformMovementDto } from './dto/asset.dto';
import type { Asset } from './entities/asset.entity';
import type { Movement } from './entities/movement.entity';
import type { MovementType } from './movement.logic';

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
}
