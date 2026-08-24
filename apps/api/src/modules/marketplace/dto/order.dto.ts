import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  tenantSlug!: string;

  @IsString()
  listingSlug!: string;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class QuoteDto {
  @IsString()
  tenantSlug!: string;

  @IsString()
  listingSlug!: string;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;
}
