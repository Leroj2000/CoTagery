import { BadRequestException, Controller, Headers, Post, Req } from '@nestjs/common';
import { SpecCallbackService, type SpecCallbackResult } from './spec-callback.service';

interface RawBodyReq {
  rawBody?: Buffer;
}

/**
 * Veřejný callback endpoint pro AI dohledání specifikací (n8n) – bez JWT.
 * HMAC + tenant scoping řeší service. URL: POST /api/v1/specs/webhook/callback
 */
@Controller('specs/webhook')
export class SpecCallbackController {
  constructor(private readonly callback: SpecCallbackService) {}

  @Post('callback')
  handle(
    @Req() req: RawBodyReq,
    @Headers('x-manual-signature') signature: string,
  ): Promise<SpecCallbackResult> {
    const raw = req.rawBody?.toString('utf8');
    if (!raw) throw new BadRequestException('Chybí tělo požadavku');
    return this.callback.handle(raw, signature ?? '');
  }
}
