import {
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateListingDto {
  @IsUUID()
  assetId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  terms?: string;

  @IsOptional()
  @IsUUID()
  pickupLocationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsNumberString()
  pricePerDay?: string;

  @IsOptional()
  @IsNumberString()
  pricePerHour?: string;

  @IsOptional()
  @IsNumberString()
  pricePerWeek?: string;

  @IsOptional()
  @IsNumberString()
  depositAmount?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  minDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  maxDays?: number;
}

export class UpdateListingDto extends CreateListingDto {
  @IsOptional()
  @IsUUID()
  declare assetId: string;
}
