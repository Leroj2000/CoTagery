import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
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
}
