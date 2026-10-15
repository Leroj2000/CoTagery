import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { CALENDAR_SOURCES, type CalendarSource } from '@tagery/shared';

export class CalendarRangeQuery {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class CreateCalendarEventDto {
  @IsString()
  @Length(1, 200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  location?: string;

  @IsDateString()
  startsAt!: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsBoolean()
  allDay?: boolean;
}

export class UpdateCalendarEventDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  location?: string | null;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string | null;

  @IsOptional()
  @IsBoolean()
  allDay?: boolean;
}

export class CreateCalendarShareDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsArray()
  @ArrayMaxSize(CALENDAR_SOURCES.length)
  @IsIn(CALENDAR_SOURCES as unknown as string[], { each: true })
  sources!: CalendarSource[];

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
