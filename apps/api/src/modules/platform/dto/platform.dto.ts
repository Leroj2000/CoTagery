import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const TENANT_TYPES = ['retail', 'event', 'rental', 'home', 'mixed'] as const;

export class CreateTenantDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsIn(TENANT_TYPES)
  type?: (typeof TENANT_TYPES)[number];

  @IsString()
  @MaxLength(200)
  ownerName!: string;

  @IsEmail()
  ownerEmail!: string;
}
