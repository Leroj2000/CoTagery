import { Body, Controller, Ip, Param, Post } from '@nestjs/common';
import { IsObject, IsOptional, IsString, Length } from 'class-validator';
import { ActivationService, type ActivationResult } from './activation.service';

class ActivateDto {
  @IsString()
  @Length(4, 12)
  pin!: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}

/** Veřejný self-aktivační endpoint (bez JWT), mimo /api/v1. */
@Controller('r')
export class ActivationController {
  constructor(private readonly activation: ActivationService) {}

  @Post(':code/activate')
  activate(
    @Param('code') code: string,
    @Body() dto: ActivateDto,
    @Ip() ip: string,
  ): Promise<ActivationResult> {
    return this.activation.activate(code, dto.pin, dto.payload, ip);
  }
}
