import type { OrderStatus } from './entities/rental-order.entity';

/**
 * Stavový automat objednávky půjčovny (EPIC-19 §5, F3). Přechody řídí majitel
 * (potvrzení platby, předání, vrácení) + systém (expirace). Čistá logika bez
 * DB – testovatelná; efekty (custody pohyby, kauce) řeší service.
 */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['awaiting_payment', 'cancelled', 'expired'],
  awaiting_payment: ['paid', 'cancelled', 'expired'],
  paid: ['confirmed', 'picked_up', 'cancelled'],
  confirmed: ['picked_up', 'cancelled'],
  picked_up: ['returned'],
  returned: ['completed'],
  completed: [],
  cancelled: [],
  expired: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** Přechody, které majitel spouští explicitní akcí (mapování akce → cílový stav). */
export const OWNER_ACTIONS = {
  confirm_payment: 'paid',
  pickup: 'picked_up',
  return: 'returned',
  complete: 'completed',
  cancel: 'cancelled',
} as const satisfies Record<string, OrderStatus>;

export type OwnerAction = keyof typeof OWNER_ACTIONS;

/** Je objednávka v aktivním (běžícím) stavu – blokuje dostupnost věci. */
export function isBlocking(status: OrderStatus): boolean {
  return ['awaiting_payment', 'paid', 'confirmed', 'picked_up'].includes(status);
}
