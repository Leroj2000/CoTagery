import { IsOptional, IsString, IsUUID } from 'class-validator';

export class StartInventoryDto {
  @IsUUID()
  locationId!: string;
}

export class ScanInventoryDto {
  /** Buď přímo assetId, nebo public_code nosiče (naskenovaný kód). */
  @IsOptional()
  @IsUUID()
  assetId?: string;

  @IsOptional()
  @IsString()
  publicCode?: string;
}
