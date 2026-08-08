import {
  IsEmail,
  IsIn,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { VERIFICATION_LEVELS } from '../verification';

export class CreateRenterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  displayName!: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class VerifyRenterDto {
  @IsIn(VERIFICATION_LEVELS)
  level!: (typeof VERIFICATION_LEVELS)[number];
}

export class CreateItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsNumberString()
  pricePerDay?: string;

  @IsOptional()
  @IsNumberString()
  deposit?: string;

  @IsOptional()
  @IsIn(VERIFICATION_LEVELS)
  requiredVerificationLevel?: (typeof VERIFICATION_LEVELS)[number];
}

export class CreateLoanDto {
  @IsUUID()
  renterProfileId!: string;

  @IsOptional()
  @IsString()
  rentalStart?: string;

  @IsOptional()
  @IsString()
  rentalEnd?: string;
}

export class CreateReviewDto {
  @IsIn(['lessor_to_renter', 'renter_to_lessor'])
  direction!: 'lessor_to_renter' | 'renter_to_lessor';

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
