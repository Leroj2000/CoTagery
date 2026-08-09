import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateDataCarrierDto {
  @IsOptional()
  @IsIn(['qr', 'nfc', 'hybrid'])
  carrierType?: 'qr' | 'nfc' | 'hybrid';
}

export class GenerateBatchDto {
  @IsInt()
  @Min(1)
  @Max(500)
  count!: number;

  @IsOptional()
  @IsIn(['qr', 'nfc', 'hybrid'])
  carrierType?: 'qr' | 'nfc' | 'hybrid';
}

export class ClaimCarrierDto {
  @IsString()
  @MaxLength(32)
  publicCode!: string;

  @IsString()
  @MaxLength(64)
  objectId!: string;
}

export class NfcPairDto {
  @IsString()
  @MaxLength(64)
  nfcUid!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  nfcPayload?: string;
}
