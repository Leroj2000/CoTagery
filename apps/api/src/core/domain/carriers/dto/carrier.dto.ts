import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDataCarrierDto {
  @IsOptional()
  @IsIn(['qr', 'nfc', 'hybrid'])
  carrierType?: 'qr' | 'nfc' | 'hybrid';
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
