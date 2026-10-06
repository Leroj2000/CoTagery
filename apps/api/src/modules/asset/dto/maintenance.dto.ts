import {
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AddMeterReadingDto {
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(1000000000)
  value!: number;
}

export class UpdateMaintenanceRuleDto {
  @IsInt()
  @Min(1)
  @Max(1000000)
  intervalUnits!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  intervalMonths?: number | null;

  @IsString()
  @MaxLength(1000)
  description!: string;
}

export class CompleteMaintenanceDto {
  @IsString()
  @MaxLength(40)
  planCode!: string;

  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(1000000000)
  meterValue!: number;

  @IsISO8601()
  performedAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  provider?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
