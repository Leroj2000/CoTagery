import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

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

/** Inventura vozidel: všechna vozidla (bez `assetId`) nebo jedno, k období od–do. */
export class StartVehicleInventoryDto {
  @IsOptional()
  @IsUUID()
  assetId?: string;

  @Matches(DATE, { message: 'Začátek období musí být ve tvaru RRRR-MM-DD' })
  periodFrom!: string;

  @Matches(DATE, { message: 'Konec období musí být ve tvaru RRRR-MM-DD' })
  periodTo!: string;
}

/** Zápis k vozidlu během inventury: stav tachometru a/nebo poznámka. */
export class RecordVehicleDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(1_000_000_000)
  odometer?: number;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}
