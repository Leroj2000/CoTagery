import { IsIn, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateAccessPointDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  zoneKey!: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsIn(['in', 'out', 'both'])
  direction?: 'in' | 'out' | 'both';

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}

export class EvaluateAccessDto {
  @IsString()
  @MaxLength(64)
  subjectType!: string;

  @IsString()
  @MaxLength(128)
  subjectRef!: string;
}
