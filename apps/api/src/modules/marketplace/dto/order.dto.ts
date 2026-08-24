import { IsDateString, IsIn, IsNumberString, IsOptional, IsString, MaxLength } from 'class-validator';
import { OWNER_ACTIONS, type OwnerAction } from '../order-status.logic';

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

export class OwnerActionDto {
  @IsIn(Object.keys(OWNER_ACTIONS))
  action!: OwnerAction;

  /** Jen pro `return`: kolik z kauce vrátit nájemci (default = celá). */
  @IsOptional()
  @IsNumberString()
  depositReturned?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class RenterIssueDto {
  @IsIn(['damage', 'malfunction', 'missing_part', 'other'])
  kind!: 'damage' | 'malfunction' | 'missing_part' | 'other';

  @IsString()
  @MaxLength(2000)
  description!: string;
}
