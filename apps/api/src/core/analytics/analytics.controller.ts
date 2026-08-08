import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AnalyticsService, type AnalyticsOverview } from './analytics.service';
import type { ScanEvent } from '../domain/entities/scan-event.entity';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  overview(): Promise<AnalyticsOverview> {
    return this.analytics.overview();
  }

  @Get('scans')
  scans(
    @Query('objectId') objectId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<ScanEvent[]> {
    return this.analytics.scans(objectId, from, to);
  }
}
