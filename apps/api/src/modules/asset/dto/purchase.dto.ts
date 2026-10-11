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
  ValidateIf,
} from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Uložení pořízení. Prázdné pole = smazat hodnotu (`null`). */
export class UpsertPurchaseDto {
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Matches(DATE, { message: 'Datum pořízení musí být ve tvaru RRRR-MM-DD' })
  purchasedOn?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(200)
  supplier?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(100)
  documentNumber?: string | null;

  /** Zadaná cena; podle `priceIncludesVat` s DPH nebo bez. */
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999_999_999_999)
  price?: number | null;

  @IsOptional()
  @IsBoolean()
  priceIncludesVat?: boolean;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  vatRate?: number | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(2000)
  note?: string | null;
}

export class WarrantyDto {
  @IsString()
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Matches(DATE, { message: 'Začátek záruky musí být ve tvaru RRRR-MM-DD' })
  startsOn?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsInt()
  @Min(1)
  @Max(600)
  months?: number | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Matches(DATE, { message: 'Konec záruky musí být ve tvaru RRRR-MM-DD' })
  endsOn?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(200)
  provider?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(2000)
  note?: string | null;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsUUID()
  documentId?: string | null;
}

export class UploadDocumentDto {
  @IsIn(['invoice', 'warranty', 'other'])
  docType!: 'invoice' | 'warranty' | 'other';
}
