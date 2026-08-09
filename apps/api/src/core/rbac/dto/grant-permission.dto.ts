import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { ObjectPermissionLevel } from '@tagery/shared';

const LEVELS: ObjectPermissionLevel[] = ['owner', 'manage', 'edit', 'view', 'scan_only'];

export class GrantPermissionDto {
  @IsIn(['user', 'group', 'tenant'])
  subjectType!: 'user' | 'group' | 'tenant';

  @IsString()
  @MaxLength(128)
  subjectId!: string;

  @IsIn(LEVELS)
  permission!: ObjectPermissionLevel;

  @IsOptional()
  @IsString()
  expiresAt?: string;
}
