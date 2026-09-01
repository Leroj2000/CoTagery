import { IsBoolean, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsBoolean()
  networkListed?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(253)
  brandingDomain?: string;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
