import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { AccessControlService } from './access-control.service';
import { CreateAccessPointDto, EvaluateAccessDto } from './dto/access.dto';
import type { AccessPoint } from './entities/access-point.entity';
import type { AccessEvent } from './entities/access-event.entity';
import type { AccessDecision } from './entitlement';

@Controller('access-points')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AccessPointsController {
  constructor(private readonly access: AccessControlService) {}

  @Get()
  list(): Promise<AccessPoint[]> {
    return this.access.list();
  }

  @Post()
  @RequirePermission('access.point.manage')
  create(@Body() dto: CreateAccessPointDto): Promise<AccessPoint> {
    return this.access.create(dto);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<AccessPoint> {
    return this.access.get(id);
  }

  @Post(':id/evaluate')
  evaluate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EvaluateAccessDto,
  ): Promise<AccessDecision> {
    return this.access.evaluate(id, dto.subjectType, dto.subjectRef);
  }

  @Get(':id/events')
  events(@Param('id', ParseUUIDPipe) id: string): Promise<AccessEvent[]> {
    return this.access.listEvents(id);
  }
}
