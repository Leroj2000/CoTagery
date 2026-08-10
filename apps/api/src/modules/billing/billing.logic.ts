import { createHmac, timingSafeEqual } from 'node:crypto';
import type { MembershipStatus } from '../membership/entities/membership.entity';
import type { SubscriptionStatus } from './entities/subscription.entity';

/**
 * DPH rozpad faktury. Reverse charge (EU B2B mimo CZ) → 0 % a příznak;
 * jinak standardní sazba (default 21 %). Vstup/výstup jako string kvůli
 * numeric přesnosti; zaokrouhlení na 2 desetinná místa.
 */
export function computeVat(
  amountNet: string,
  vatRate: number,
  reverseCharge: boolean,
): { vatAmount: string; vatRate: string; gross: string } {
  const net = Number(amountNet);
  const rate = reverseCharge ? 0 : vatRate;
  const vat = Math.round(net * rate) / 100;
  const gross = Math.round((net + vat) * 100) / 100;
  return { vatAmount: vat.toFixed(2), vatRate: rate.toFixed(0), gross: gross.toFixed(2) };
}

/**
 * Mapování stavu předplatného na stav členství (EPIC-16/17). `past_due` drží
 * členství aktivní po dobu grace (dunning); expirace se řeší až časovým během.
 */
export function subscriptionStatusToMembership(status: SubscriptionStatus): MembershipStatus {
  switch (status) {
    case 'active':
    case 'trialing':
    case 'past_due':
      return 'active';
    case 'canceled':
      return 'cancelled';
    case 'incomplete':
    default:
      return 'suspended';
  }
}

/** Podpis webhook payloadu (stub PSP) – HMAC-SHA256 hex. */
export function signWebhook(rawBody: string, secret: string): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

/** Ověření podpisu v konstantním čase (odolné vůči timing útoku). */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  const expected = signWebhook(rawBody, secret);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature ?? '', 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
