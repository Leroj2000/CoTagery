/** Sdílené tvary entit vrácených API (jen pole, která admin renderuje). */

export interface DigitalObject {
  id: string;
  moduleType: string;
  slug: string;
  status: string;
  primaryUrl: string | null;
  createdAt: string;
}

export interface DataCarrier {
  id: string;
  publicCode: string;
  carrierType: string;
  status: string;
  resolverUrl: string | null;
}

export interface MembershipTier {
  id: string;
  name: string;
  level: number;
  price: string;
  currency: string;
  validityDays: number;
  graceDays: number;
  zoneKeys: string[];
}

export interface Member {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

export interface Subscription {
  id: string;
  tierId: string;
  membershipId: string | null;
  status: string;
  currentPeriodEnd: string | null;
  pspSubscriptionRef: string;
}

export interface UsageMeter {
  id: string;
  period: string;
  metric: string;
  quantity: number;
  reportedAt: string | null;
}

export interface Invoice {
  id: string;
  pspInvoiceRef: string;
  amountNet: string;
  vatAmount: string;
  vatRate: string;
  reverseCharge: boolean;
  currency: string;
  status: string;
  periodEnd: string | null;
}

export interface AccessPoint {
  id: string;
  name: string;
  zoneKey: string;
  direction: string;
}

export interface AccessEvent {
  id: string;
  subjectType: string;
  subjectRef: string;
  decision: string;
  reason: string | null;
  createdAt: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  tenantRole: string;
  status: string;
  createdAt: string;
}
