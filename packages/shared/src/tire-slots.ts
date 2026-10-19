/**
 * Termíny přezutí pneumatik: firma vypíše sloty (den × délka × kapacita), držitel
 * nebo odpovědná osoba vozidla si jeden zarezervuje. Rezervovat i rušit jde jen
 * do 24 h před začátkem termínu (správce smí i později).
 */

export const TIRE_SLOT_SEASONS = ['winter', 'summer'] as const;
export type TireSlotSeason = (typeof TIRE_SLOT_SEASONS)[number];

export const TIRE_SLOT_SEASON_LABELS: Record<TireSlotSeason, string> = {
  winter: 'na zimní',
  summer: 'na letní',
};

export type TireBookingStatus = 'booked' | 'cancelled' | 'done';

/** Uzávěrka rezervace/zrušení před začátkem termínu. */
export const TIRE_BOOKING_CUTOFF_HOURS = 24;

export interface TireBookingView {
  id: string;
  slotId: string;
  assetId: string;
  assetName: string;
  plate: string | null;
  personId: string | null;
  personName: string | null;
  status: TireBookingStatus;
  startsAt: string;
  endsAt: string;
  location: string | null;
  season: TireSlotSeason | null;
  /** Lze ještě měnit/rušit (mimo uzávěrku, nebo správce). */
  changeable: boolean;
}

export interface TireSlotView {
  id: string;
  startsAt: string;
  endsAt: string;
  location: string | null;
  note: string | null;
  capacity: number;
  season: TireSlotSeason | null;
  booked: number;
  /** Volné místo a mimo uzávěrku – lze rezervovat. */
  bookable: boolean;
  /** Správce: všechny rezervace; ostatní: jen vlastní. */
  bookings: TireBookingView[];
}

/** Stav přezutí jednoho vozidla (detail položky, „Moje vybavení“). */
export interface AssetTireBookingView {
  assetId: string;
  assetName: string;
  plate: string | null;
  booking: TireBookingView | null;
  /** Smí aktuální uživatel pro vozidlo rezervovat. */
  canBook: boolean;
  /** Důvod, proč rezervovat nejde (např. vozidlo bez držitele). */
  reason: string | null;
  /** Nejbližší volné termíny (max. 3). */
  suggestions: TireSlotView[];
}
