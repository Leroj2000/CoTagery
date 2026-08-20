import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { IsArray, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from './permissions.guard';
import { RequirePermission } from './require-permission.decorator';
import { PolicyService } from './policy.service';
import type { Policy } from './entities/policy.entity';
import type { PolicyAssignment } from './entities/policy-assignment.entity';

class CreateTimeWindowDto {
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  days?: number[];

  @IsOptional()
  @IsString()
  @MaxLength(5)
  from?: string; // HH:MM

  @IsOptional()
  @IsString()
  @MaxLength(5)
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  tz?: string;
}

class AssignPolicyDto {
  @IsUUID()
  membershipId!: string;
}

/** Deklarativní policy (EPIC-18 Fáze 4) – správa jen admin (core.organization.configure). */
@Controller('policies')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PolicyController {
  constructor(private readonly policies: PolicyService) {}

  @Get()
  @RequirePermission('core.organization.configure')
  list(): Promise<Policy[]> {
    return this.policies.listPolicies();
  }

  @Post('time-window')
  @RequirePermission('core.organization.configure')
  create(@Body() dto: CreateTimeWindowDto): Promise<Policy> {
    return this.policies.createTimeWindow(dto);
  }

  @Post(':id/assign')
  @RequirePermission('core.organization.configure')
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignPolicyDto,
  ): Promise<PolicyAssignment> {
    return this.policies.assign(id, dto.membershipId);
  }
}
