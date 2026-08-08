import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const LOCATION_TYPES = ['store', 'venue', 'warehouse', 'office', 'home'] as const;

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
}
