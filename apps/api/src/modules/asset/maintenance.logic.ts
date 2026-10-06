export type EquipmentKind = 'general' | 'vehicle' | 'machine';
export type MaintenanceStatus = 'not_started' | 'need_reading' | 'ok' | 'soon' | 'overdue';

export interface MaintenanceTemplate {
  code: string;
  title: string;
  description: string;
  intervalUnits: number;
  intervalMonths: number | null;
}

/** Orientační plány. Konkrétní servisní knížka výrobce má vždy přednost. */
export const MAINTENANCE_TEMPLATES: Record<'vehicle' | 'machine', MaintenanceTemplate[]> = {
  vehicle: [
    {
      code: 'safety',
      title: 'Provozní a bezpečnostní kontrola',
      description: 'Pneumatiky, brzdy, osvětlení, kapaliny a zjevné závady; podle návodu vozidla.',
      intervalUnits: 10000,
      intervalMonths: 12,
    },
    {
      code: 'regular',
      title: 'Pravidelný servis',
      description: 'Kontrola a výměny předepsané výrobcem (např. filtry a provozní kapaliny).',
      intervalUnits: 15000,
      intervalMonths: 12,
    },
    {
      code: 'major',
      title: 'Rozšířená prohlídka',
      description: 'Podrobnější kontrola pohonu, podvozku a brzd podle servisního plánu modelu.',
      intervalUnits: 30000,
      intervalMonths: 24,
    },
  ],
  machine: [
    {
      code: 'pm250',
      title: 'PM 250',
      description: 'Základní údržba: mazání, kapaliny, úniky a bezpečnostní prvky podle návodu.',
      intervalUnits: 250,
      intervalMonths: null,
    },
    {
      code: 'pm500',
      title: 'PM 500',
      description: 'Rozšířená údržba: filtry, hydraulika, pohon a opotřebení podle návodu.',
      intervalUnits: 500,
      intervalMonths: null,
    },
    {
      code: 'pm1000',
      title: 'PM 1000',
      description: 'Velká servisní prohlídka systémů stroje podle servisního plánu výrobce.',
      intervalUnits: 1000,
      intervalMonths: null,
    },
  ],
};

export function addCalendarMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const finalDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(day, finalDay));
  return result;
}

export function calculateMaintenance(
  rule: Pick<MaintenanceTemplate, 'intervalUnits' | 'intervalMonths'>,
  last: { performedAt: Date | null; meterValue: number | null } | null,
  currentMeter: number | null,
  now = new Date(),
): { status: MaintenanceStatus; nextMeter: number | null; nextDueAt: Date | null } {
  if (!last) return { status: 'not_started', nextMeter: null, nextDueAt: null };
  const nextMeter = last.meterValue == null ? null : last.meterValue + rule.intervalUnits;
  const nextDueAt =
    last.performedAt && rule.intervalMonths
      ? addCalendarMonths(last.performedAt, rule.intervalMonths)
      : null;
  const meterOverdue = nextMeter != null && currentMeter != null && currentMeter >= nextMeter;
  // A calendar deadline is overdue only after the due day has passed.
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const dueDay = nextDueAt
    ? Date.UTC(nextDueAt.getUTCFullYear(), nextDueAt.getUTCMonth(), nextDueAt.getUTCDate())
    : null;
  const dateOverdue = dueDay != null && today > dueDay;
  if (meterOverdue || dateOverdue) return { status: 'overdue', nextMeter, nextDueAt };
  const meterSoon =
    nextMeter != null &&
    currentMeter != null &&
    currentMeter >= nextMeter - Math.ceil(rule.intervalUnits * 0.1);
  const dateSoon = dueDay != null && dueDay - today <= 30 * 86400000;
  if (meterSoon || dateSoon) return { status: 'soon', nextMeter, nextDueAt };
  if (currentMeter == null && nextMeter != null)
    return { status: 'need_reading', nextMeter, nextDueAt };
  return { status: 'ok', nextMeter, nextDueAt };
}
