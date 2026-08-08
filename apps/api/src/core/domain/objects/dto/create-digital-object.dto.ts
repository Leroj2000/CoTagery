import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';
import type { ModuleType } from '@tagery/shared';

export const MODULE_TYPES: ModuleType[] = [
  'product',
  'loyalty',
  'pay',
  'inventory',
  'trace',
  'membership',
  'ticket',
  'rental',
  'gallery',
  'time_tracker',
  'automation',
  'contact',
  'access_point',
];

export class CreateDigitalObjectDto {
  @IsIn(MODULE_TYPES)
  moduleType!: ModuleType;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]{1,64}$/, { message: 'slug: povolené jsou a-z, 0-9 a pomlčka' })
  slug?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  primaryUrl?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  validFrom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  validTo?: string;
}
