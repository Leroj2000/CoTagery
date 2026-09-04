import { IsHexColor, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreatePersonCategoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsHexColor()
  color?: string;
}

export class SetCategoryDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;
}
