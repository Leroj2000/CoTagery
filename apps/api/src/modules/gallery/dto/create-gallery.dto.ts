import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateGalleryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsUUID()
  digitalObjectId?: string;

  @IsOptional()
  @IsString()
  eventDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  deleteAfterDays?: number;

  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;
}
