/**
 * Abstrakce platby (EPIC-19 §3). Umožňuje vyměnit MVP QR/převod (Adapter A) za
 * PSP „jako Alza" (Adapter B – Stripe Connect, F4) bez přepisu objednávek.
 */
export const PAYMENT_ADAPTER = Symbol('PAYMENT_ADAPTER');

export interface PaymentInstructionInput {
  iban: string;
  accountName?: string | null;
  amount: string;
  currency: string;
  variableSymbol: string;
  message: string;
}

export interface PaymentInstruction {
  method: 'qr_transfer';
  iban: string;
  accountName: string | null;
  amount: string;
  currency: string;
  variableSymbol: string;
  message: string;
  /** SPAYD řetězec pro QR platbu (renderuje se do QR obrázku). */
  spayd: string;
}

export interface PaymentAdapter {
  /** Vytvoří pokyny k platbě (QR/SPAYD string | PSP intent). */
  createInstruction(input: PaymentInstructionInput): PaymentInstruction;
}
