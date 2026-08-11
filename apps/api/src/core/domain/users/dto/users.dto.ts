import { IsEmail, IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import type { TenantRole } from '@tagery/shared';

const ROLES: TenantRole[] = ['OWNER', 'ADMIN', 'MANAGER', 'EDITOR', 'VIEWER', 'SCAN_ONLY'];

export class InviteUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsIn(ROLES)
  tenantRole!: TenantRole;
}

export class UpdateRoleDto {
  @IsIn(ROLES)
  tenantRole!: TenantRole;
}
