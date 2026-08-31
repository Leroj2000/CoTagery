import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { WalletFormat, WalletKind } from '../entities/wallet-code.entity';

export class CreateWalletCodeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label!: string;

  @IsIn(['discount', 'access'])
  kind!: WalletKind;

  @IsIn(['qr', 'barcode', 'nfc'])
  format!: WalletFormat;

  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  value!: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  note?: string;
}
