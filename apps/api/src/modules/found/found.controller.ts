import { Body, Controller, Get, Ip, Param, Post, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/rbac/permissions.guard';
import { AllowAuthenticatedOnly, RequirePermission } from '../../core/rbac/require-permission.decorator';
import { FoundService } from './found.service';
import type { FoundReport } from './entities/found-report.entity';

class ReportFoundDto {
  @IsString()
  @Length(1, 2000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  contact?: string;
}

/** Veřejné nahlášení nálezu (bez JWT), mimo /api/v1 prefix. */
@Controller('r')
export class FoundPublicController {
  constructor(private readonly found: FoundService) {}

  @Post(':code/found')
  async report(
    @Param('code') code: string,
    @Body() dto: ReportFoundDto,
    @Ip() ip: string,
  ): Promise<{ ok: true }> {
    await this.found.report(code, dto.message, dto.contact, ip);
    return { ok: true };
  }
}

/** Přehled nahlášených nálezů pro majitele (autentizovaně). */
@Controller('found-reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FoundReportsController {
  constructor(private readonly found: FoundService) {}

  @Get()
  @AllowAuthenticatedOnly()
  list(): Promise<FoundReport[]> {
    return this.found.list();
  }

  @Post(':id/handle')
  @RequirePermission('found.report.handle')
  handle(@Param('id') id: string): Promise<FoundReport> {
    return this.found.handle(id);
  }
}
