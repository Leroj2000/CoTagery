import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { HolderType, MovementType } from '../movement.logic';

const MOVEMENT_TYPES: MovementType[] = [
  'assign',
  'loan',
  'move',
  'return',
  'handover',
  'service_out',
  'service_return',
  'dispose',
];
const HOLDER_TYPES: HolderType[] = ['location', 'person', 'asset'];

export class CreateAssetDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  manufacturer?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  serialNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  inventoryNumber?: string;

  @IsOptional()
  @IsUUID()
  homeLocationId?: string;

  /** Označit jako kontejner (dodávka, kufr) – může obsahovat další věci. */
  @IsOptional()
  @IsBoolean()
  canContainAssets?: boolean;
}

export class PutIntoContainerDto {
  @IsUUID()
  childAssetId!: string;
}

export class ImportCsvDto {
  @IsString()
  csv!: string;
}

export class ReportIssueDto {
  @IsIn(['damage', 'malfunction', 'missing_part', 'other'])
  kind!: 'damage' | 'malfunction' | 'missing_part' | 'other';

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  description!: string;

  @IsOptional()
  @IsUUID()
  reportedById?: string;
}

export class CreateCategoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;
}

export class UpdateCategoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
}

export class PerformMovementDto {
  @IsIn(MOVEMENT_TYPES)
  type!: MovementType;

  @IsOptional()
  @IsIn(HOLDER_TYPES)
  toType?: HolderType;

  @IsOptional()
  @IsUUID()
  toId?: string;

  @IsOptional()
  @IsUUID()
  actorPersonId?: string;

  @IsOptional()
  @IsString()
  dueAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  /** Vyžádat potvrzení převzetí příjemcem (§8). */
  @IsOptional()
  @IsBoolean()
  requireConfirmation?: boolean;
}

export class BulkMovementDto extends PerformMovementDto {
  @IsArray()
  @IsUUID('4', { each: true })
  assetIds!: string[];
}

export class AddServiceDto {
  @IsIn(['service', 'inspection', 'calibration', 'repair'])
  kind!: 'service' | 'inspection' | 'calibration' | 'repair';

  @IsOptional()
  @IsString()
  performedAt?: string;

  @IsOptional()
  @IsString()
  nextDueAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  provider?: string;

  @IsOptional()
  @IsString()
  cost?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class CreateReservationDto {
  @IsUUID()
  assetId!: string;

  @IsOptional()
  @IsUUID()
  requestedById?: string;

  @IsOptional()
  @IsString()
  fromAt?: string;

  @IsOptional()
  @IsString()
  toAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  purpose?: string;
}
