import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

import { LOCATION_TYPES } from './create-location.dto';

export class UpdateLocationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsIn(LOCATION_TYPES)
  type?: (typeof LOCATION_TYPES)[number];

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}
