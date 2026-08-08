import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateProductDto {
  @IsUUID()
  digitalObjectId!: string;

  @IsString()
  @MaxLength(300)
  name!: string;

  @IsOptional()
  @IsString()
  gtin?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  ingredients?: string;

  @IsOptional()
  @IsString()
  origin?: string;

  @IsOptional()
  @IsString()
  careInstructions?: string;
}
