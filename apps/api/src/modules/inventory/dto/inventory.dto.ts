import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class StartInventoryDto {
  /** Nad čím inventura: 'location' (default), 'person' nebo 'asset' (kontejner). */
  @IsOptional()
  @IsIn(['location', 'person', 'asset'])
  subjectType?: 'location' | 'person' | 'asset';

  /** ID subjektu (lokace/osoby/kontejneru). Alias `locationId` kvůli kompatibilitě. */
  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;
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

export class ReconcileDto {
  /** Věc z „navíc", jejíž evidenci chceme přesunout do inventarizovaného místa. */
  @IsUUID()
  assetId!: string;
}
