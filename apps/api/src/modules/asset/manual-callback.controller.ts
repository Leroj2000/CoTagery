import { BadRequestException, Controller, Headers, Post, Req } from '@nestjs/common';
import { ManualCallbackService, type CallbackResult } from './manual-callback.service';

/** Minimální tvar requestu s raw body (viz `rawBody: true` v main.ts). */
interface RawBodyReq {
  rawBody?: Buffer;
}

/**
 * Veřejný callback endpoint pro AI stažení manuálu (n8n) – bez JWT. Ověření
 * HMAC podpisu + tenant scoping řeší service. Potřebuje raw body (main.ts).
 * URL: POST /api/v1/manuals/webhook/callback
 */
@Controller('manuals/webhook')
export class ManualCallbackController {
  constructor(private readonly callback: ManualCallbackService) {}

  @Post('callback')
  handle(
    @Req() req: RawBodyReq,
    @Headers('x-manual-signature') signature: string,
  ): Promise<CallbackResult> {
    const raw = req.rawBody?.toString('utf8');
    if (!raw) throw new BadRequestException('Chybí tělo požadavku');
    return this.callback.handle(raw, signature ?? '');
  }
}
