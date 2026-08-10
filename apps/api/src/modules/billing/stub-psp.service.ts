import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { signWebhook } from './billing.logic';

export interface StubCheckoutSession {
  checkoutUrl: string;
  pspCustomerRef: string;
  pspSubscriptionRef: string;
}

/**
 * Stub PSP (EPIC-17). Nahrazuje Stripe do doby rozhodnutí o PSP (ADR-0007):
 * generuje fake reference a umí "podepsat" webhook payload sdíleným tajemstvím.
 * Reálná integrace jen vymění tuto třídu za Stripe SDK adaptér.
 */
@Injectable()
export class StubPspService {
  private ref(prefix: string): string {
    return `${prefix}_${randomBytes(9).toString('hex')}`;
  }

  createCheckoutSession(): StubCheckoutSession {
    const pspSubscriptionRef = this.ref('sub');
    return {
      pspCustomerRef: this.ref('cus'),
      pspSubscriptionRef,
      checkoutUrl: `https://stub-psp.local/checkout/${pspSubscriptionRef}`,
    };
  }

  newInvoiceRef(): string {
    return this.ref('in');
  }

  newEventRef(): string {
    return this.ref('evt');
  }

  /** URL zákaznického portálu PSP (self-service správa předplatného). */
  customerPortalUrl(pspCustomerRef: string): string {
    return `https://stub-psp.local/portal/${pspCustomerRef}`;
  }

  /** Podepíše payload pro simulaci příchozího webhooku (dev/test). */
  sign(rawBody: string, secret: string): string {
    return signWebhook(rawBody, secret);
  }
}
