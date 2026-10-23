import type { MailAttachment } from '../../core/mail/mail.service';
import { foldLine, icsEscape } from '../calendar/calendar.logic';

/**
 * iCalendar (RFC 5545) k e-mailům o termínu přezutí. Záměrně bez ORGANIZER/
 * ATTENDEE: METHOD:PUBLISH se v Gmailu, Apple Kalendáři i Outlooku importuje jako
 * běžná událost a Tagery nevystupuje jako organizátor čekající na odpověď (RSVP).
 * Zrušení posílá METHOD:CANCEL se stejným UID (klient, který to podporuje,
 * událost odstraní; jinak slouží jako informace). Časy v UTC (bez VTIMEZONE).
 */
export interface TireBookingEvent {
  bookingId: string;
  assetName: string;
  plate: string | null;
  startsAt: Date;
  endsAt: Date;
  location: string | null;
  /** Odkaz na detail vozidla (do DESCRIPTION a URL). */
  url: string;
  description?: string;
}

export function tireBookingUid(bookingId: string): string {
  return `tire-booking-${bookingId}@tagery.tech`;
}

function utc(d: Date): string {
  return d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

export function tireBookingSummary(e: Pick<TireBookingEvent, 'assetName' | 'plate'>): string {
  return `Přezutí pneumatik – ${e.assetName}${e.plate ? ` ${e.plate}` : ''}`;
}

export function buildTireBookingIcs(
  e: TireBookingEvent,
  method: 'PUBLISH' | 'CANCEL',
  now: Date = new Date(),
): string {
  const cancel = method === 'CANCEL';
  const desc = [e.description, e.url].filter(Boolean).join('\n');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tagery//Prezuti pneumatik//CS',
    'CALSCALE:GREGORIAN',
    `METHOD:${method}`,
    'BEGIN:VEVENT',
    `UID:${tireBookingUid(e.bookingId)}`,
    `DTSTAMP:${utc(now)}`,
    // Zrušení musí mít vyšší SEQUENCE než původní událost.
    `SEQUENCE:${cancel ? 1 : 0}`,
    `DTSTART:${utc(e.startsAt)}`,
    `DTEND:${utc(e.endsAt)}`,
    `SUMMARY:${icsEscape(cancel ? `Zrušeno: ${tireBookingSummary(e)}` : tireBookingSummary(e))}`,
  ];
  if (e.location) lines.push(`LOCATION:${icsEscape(e.location)}`);
  if (desc) lines.push(`DESCRIPTION:${icsEscape(desc)}`);
  lines.push(
    `URL:${e.url}`,
    `STATUS:${cancel ? 'CANCELLED' : 'CONFIRMED'}`,
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR',
  );
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

export function tireBookingAttachment(
  e: TireBookingEvent,
  method: 'PUBLISH' | 'CANCEL',
  now: Date = new Date(),
): MailAttachment {
  return {
    filename: method === 'CANCEL' ? 'prezuti-zruseno.ics' : 'prezuti.ics',
    content: buildTireBookingIcs(e, method, now),
    contentType: `text/calendar; charset=utf-8; method=${method}`,
  };
}
