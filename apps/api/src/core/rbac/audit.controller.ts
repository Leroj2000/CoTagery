import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from './permissions.guard';
import { RequirePermission } from './require-permission.decorator';
import { AuditService } from './audit.service';
import type { AuditEvent } from './entities/audit-event.entity';

/** Auditní log organizace (EPIC-18 Fáze 4). */
@Controller('audit-events')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermission('core.audit.view')
  list(): Promise<AuditEvent[]> {
    return this.audit.list();
  }
}
