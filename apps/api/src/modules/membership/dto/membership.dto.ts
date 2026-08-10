import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { BenefitKind } from '../entities/membership-benefit.entity';

export class CreateMemberDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  externalRef?: string;
}

export class CreateTierDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  level?: number;

  @IsOptional()
  @IsNumberString()
  price?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  validityDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  graceDays?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  zoneKeys?: string[];
}

export class CreateBenefitDto {
  @IsString()
  kind!: BenefitKind;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  targetKey?: string;

  @IsOptional()
  @IsNumberString()
  value?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;
}

export class IssueMembershipDto {
  @IsUUID()
  memberId!: string;

  @IsUUID()
  tierId!: string;

  @IsOptional()
  @IsString()
  validFrom?: string;

  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;
}

export class IssueCardDto {
  @IsUUID()
  dataCarrierId!: string;
}
