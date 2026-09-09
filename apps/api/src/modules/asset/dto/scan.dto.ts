import { Type } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
  ValidateIf,
} from 'class-validator';

/** Device-reported coordinates: evidence of an observation, never proof of presence. */
export class ScanPositionDto {
  @IsNumber() @Min(-90) @Max(90) latitude!: number;
  @IsNumber() @Min(-180) @Max(180) longitude!: number;
  @ValidateIf((value) => value.source !== 'manual' || value.accuracyMeters !== undefined)
  @IsNumber()
  @Min(0)
  accuracyMeters?: number;
  @IsISO8601() capturedAt!: string;
  @IsIn(['device', 'reader', 'manual']) source!: 'device' | 'reader' | 'manual';
}

export class ScanDto {
  @IsString() @MinLength(1) @MaxLength(512) code!: string;
  @IsOptional()
  @IsIn(['qr', 'barcode', 'nfc', 'rfid', 'manual', 'unknown'])
  technology?: 'qr' | 'barcode' | 'nfc' | 'rfid' | 'manual' | 'unknown';
  @IsOptional() @IsString() @MaxLength(120) readerId?: string;
  /** A manually selected tenant location, mutually exclusive with coordinates. */
  @IsOptional() @IsUUID() manualLocationId?: string;
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ScanPositionDto)
  position?: ScanPositionDto;
}
