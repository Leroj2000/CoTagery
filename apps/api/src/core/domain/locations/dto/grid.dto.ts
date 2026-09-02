import { IsInt, Max, Min } from 'class-validator';

/** Rozdělení regálu/skříně na mřížku (počet sekcí v osách, ne řezů). */
export class GenerateGridDto {
  @IsInt()
  @Min(1)
  @Max(26)
  rows!: number;

  @IsInt()
  @Min(1)
  @Max(26)
  cols!: number;
}
