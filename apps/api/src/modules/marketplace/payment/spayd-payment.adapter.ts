import { BadRequestException, Injectable } from '@nestjs/common';
import { buildSpayd } from './spayd';
import type { PaymentAdapter, PaymentInstruction, PaymentInstructionInput } from './payment.port';

/**
 * Adapter A (MVP) – QR/převod přímo majiteli (EPIC-19 §3). Peníze tečou
 * majitel↔nájemce přímo, platforma je nedrží. Kauce se řeší manuálně při
 * vrácení. Přechod na Stripe Connect (Adapter B) = jen jiná implementace portu.
 */
@Injectable()
export class SpaydPaymentAdapter implements PaymentAdapter {
  createInstruction(input: PaymentInstructionInput): PaymentInstruction {
    if (!input.iban) {
      throw new BadRequestException('Majitel nemá nastavené bankovní údaje (IBAN) pro platbu');
    }
    let spayd: string;
    try {
      spayd = buildSpayd({
        iban: input.iban,
        amount: input.amount,
        currency: input.currency,
        vs: input.variableSymbol,
        message: input.message,
      });
    } catch {
      throw new BadRequestException('Neplatný IBAN majitele – nelze vytvořit QR platbu');
    }
    return {
      method: 'qr_transfer',
      iban: input.iban.replace(/\s+/g, '').toUpperCase(),
      accountName: input.accountName ?? null,
      amount: (Math.round(Number(input.amount) * 100) / 100).toFixed(2),
      currency: input.currency.toUpperCase(),
      variableSymbol: input.variableSymbol,
      message: input.message,
      spayd,
    };
  }
}
