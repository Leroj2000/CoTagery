import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  TIRE_AXLES,
  TIRE_CONSTRUCTIONS,
  TIRE_SEASONS,
  type TireAxle,
  type TireConstruction,
  type TireSeason,
} from '@tagery/shared';

/** Řádek pneumatik (náprava v sadě). Rozměr např. 205/55 R16 91V. */
export class CreateTireDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  setLabel!: string;

  @IsIn(TIRE_SEASONS)
  season!: TireSeason;

  @IsOptional()
  @IsIn(TIRE_AXLES)
  axle?: TireAxle;

  @Type(() => Number)
  @IsInt()
  @Min(3)
  @Max(1000)
  width!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(150)
  aspectRatio?: number | null;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(4)
  @Max(63)
  rimDiameter!: number;

  @IsOptional()
  @IsIn(TIRE_CONSTRUCTIONS)
  construction?: TireConstruction;

  @IsOptional()
  @Matches(/^\d{2,3}(\/\d{2,3})?$/, { message: 'Index nosnosti např. 91 nebo 121/120' })
  loadIndex?: string | null;

  @IsOptional()
  @Matches(/^\(?[A-Z]\)?$/, { message: 'Index rychlosti je jedno písmeno (např. V)' })
  speedIndex?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  brand?: string | null;

  @IsOptional()
  @Matches(/^\d{4}$/, { message: 'DOT jsou 4 číslice (týden a rok, např. 2423)' })
  dot?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(99)
  treadDepthMm?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  quantity?: number;

  @IsOptional()
  @IsBoolean()
  mounted?: boolean;

  @IsOptional()
  @IsUUID()
  storedLocationId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}

/** Úprava řádku – všechna pole volitelná (validace stejná jako při vytvoření). */
export class UpdateTireDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(60) setLabel?: string;
  @IsOptional() @IsIn(TIRE_SEASONS) season?: TireSeason;
  @IsOptional() @IsIn(TIRE_AXLES) axle?: TireAxle;
  @IsOptional() @Type(() => Number) @IsInt() @Min(3) @Max(1000) width?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(10) @Max(150) aspectRatio?: number | null;
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(4)
  @Max(63)
  rimDiameter?: number;
  @IsOptional() @IsIn(TIRE_CONSTRUCTIONS) construction?: TireConstruction;
  @IsOptional() @Matches(/^\d{2,3}(\/\d{2,3})?$/) loadIndex?: string | null;
  @IsOptional() @Matches(/^\(?[A-Z]\)?$/) speedIndex?: string | null;
  @IsOptional() @IsString() @MaxLength(80) brand?: string | null;
  @IsOptional() @Matches(/^\d{4}$/) dot?: string | null;
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(99)
  treadDepthMm?: number | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(24) quantity?: number;
  @IsOptional() @IsUUID() storedLocationId?: string | null;
  @IsOptional() @IsString() @MaxLength(500) note?: string | null;
}

/** Přezutí: namontuje sadu se zadaným názvem, ostatní sady položky se sundají. */
export class MountTireSetDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  setLabel!: string;
}
