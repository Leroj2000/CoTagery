import { IsInt, IsNumberString, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreateEventDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  name!: string;

  @IsOptional()
  @IsString()
  startsAt?: string;
}

export class CreateTicketTypeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsNumberString()
  price?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  quantity?: number;
}

export class IssueTicketDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  buyerName?: string;
}
