import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CheckoutDto {
  @IsUUID()
  memberId!: string;

  @IsUUID()
  tierId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  email?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  trialDays?: number;
}

export class CancelSubscriptionDto {
  @IsOptional()
  @IsBoolean()
  immediately?: boolean;
}
