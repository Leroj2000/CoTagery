/** Pořízení, doklady a záruky položky (API `/assets/:id/purchase|documents|warranties`). */

export type DocumentType = 'invoice' | 'warranty' | 'other';

export interface AssetDocument {
  id: string;
  assetId: string;
  docType: DocumentType;
  fileName: string | null;
  mime: string;
  sizeBytes: number | null;
  createdAt: string;
}

export interface AssetPurchase {
  purchasedOn: string | null;
  supplier: string | null;
  documentNumber: string | null;
  priceNet: number | null;
  vatRate: number | null;
  priceGross: number | null;
  currency: string;
  vatPayer: boolean;
  note: string | null;
}

export interface VatSettings {
  payer: boolean;
  defaultRate: number;
}

export interface PurchaseView {
  purchase: AssetPurchase | null;
  documents: AssetDocument[];
  vat: VatSettings;
}

export type WarrantyStatus = 'active' | 'expiring' | 'expired';

export interface Warranty {
  id: string;
  assetId: string;
  title: string;
  startsOn: string | null;
  months: number | null;
  endsOn: string;
  provider: string | null;
  note: string | null;
  documentId: string | null;
  status: WarrantyStatus;
  document: { id: string; fileName: string | null; mime: string } | null;
}

export interface ExpiringWarranty extends Warranty {
  assetName: string;
}

export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  invoice: 'Faktura / doklad',
  warranty: 'Záruční list',
  other: 'Jiný doklad',
};

/** BFF cesta k API pořízení (proxy `/api/asset-purchase/...`). */
export const purchaseApi = (path: string) => `/api/asset-purchase/${path}`;
export const documentUrl = (id: string) => purchaseApi(`documents/${id}/file`);

/** Datum `YYYY-MM-DD` → `1. 3. 2028` (bez posunu časové zóny). */
export function fmtDay(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d}. ${m}. ${y}`;
}

export function fmtMoney(value: number | null, currency = 'CZK'): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency }).format(value);
}

/** Dní do konce záruky podle pražského kalendáře (záporné = po konci). */
export function daysUntil(iso: string, now = new Date()): number {
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague' }).format(now);
  const utc = (day: string) => {
    const [y, m, d] = day.slice(0, 10).split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(iso) - utc(today)) / 86_400_000);
}
