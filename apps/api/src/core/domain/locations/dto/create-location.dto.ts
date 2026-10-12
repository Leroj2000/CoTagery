import { IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateLocationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  /** Klíč typu z číselníku firmy (`GET /location-types`); ověřuje služba. */
  @IsOptional()
  @Matches(/^[a-z][a-z0-9_]{1,40}$/)
  type?: string;

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
