import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export const LOCATION_TYPES = ['city', 'street', 'building', 'room', 'box', 'shelf', 'store', 'venue', 'warehouse', 'office', 'home', 'rack', 'cabinet'] as const;

export class CreateLocationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsIn(LOCATION_TYPES)
  type?: (typeof LOCATION_TYPES)[number];

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  /** Nadřazená lokace (stromová hierarchie). */
  @IsOptional()
  @IsUUID()
  parentId?: string;
}
