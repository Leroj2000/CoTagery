import { IsIn, IsObject, IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateDigitalObjectDto {
  @IsOptional()
  @IsIn(['active', 'inactive', 'archived'])
  status?: 'active' | 'inactive' | 'archived';

  @IsOptional()
  @IsUrl({ require_tld: false })
  primaryUrl?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  validTo?: string;
}
