import type { MaintenanceSummary } from '../../../lib/types';
import { ActionForm } from '../../action-form';
import { ActionButton } from '../../action-button';
import { Badge, Section, Table } from '../../ui';
import {
  addMeterReading,
  completeMaintenance,
  deleteMeterReading,
  updateMaintenanceRule,
} from '../../actions';

function number(value: number): string {
  return new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 1 }).format(value);
}

function date(value: string | null): string {
  return value ? new Date(value).toLocaleDateString('cs-CZ', { timeZone: 'UTC' }) : '—';
}

const today = () =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Prague',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

const STATUS = {
  not_started: { label: 'Chybí záznam poslední prohlídky', tone: 'slate' as const },
  need_reading: { label: 'Zadejte stav měřidla', tone: 'amber' as const },
  ok: { label: 'V termínu', tone: 'green' as const },
  soon: { label: 'Blíží se', tone: 'amber' as const },
  overdue: { label: 'Po termínu', tone: 'red' as const },
};

export function MaintenancePanel({
  assetId,
  summary,
  canEdit,
}: {
  assetId: string;
  summary: MaintenanceSummary;
  canEdit: boolean;
}) {
  if (!summary.unit) return null;
  const unit = summary.unit;
  return (
    <Section
      title={
        summary.kind === 'vehicle' ? 'Servisní intervaly vozidla' : 'Servisní intervaly stroje'
      }
      description="Orientační plán upravte podle servisní knihy výrobce. Při km/mth i časovém limitu rozhoduje dřívější hranice."
    >
      <div className="space-y-5">
        <div className="rounded-xl bg-slate-50 p-4">
          <p className="font-medium">
            Aktuální stav:{' '}
            {summary.currentReading
              ? `${number(summary.currentReading.value)} ${unit}`
              : 'není zadaný'}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Odečet slouží k upozornění. Historie se ukládá; chybný odečet lze smazat.
          </p>
          {canEdit && (
            <div className="mt-3 max-w-sm">
              <ActionForm
                action={addMeterReading}
                hidden={{ assetId }}
                submitLabel={`Uložit stav ${unit}`}
                fields={[
                  {
                    name: 'value',
                    label: `Nový stav (${unit})`,
                    type: 'number',
                    required: true,
                    min: 0,
                    max: 1000000000,
                    step: unit === 'mth' ? 0.1 : 1,
                  },
                ]}
              />
            </div>
          )}
          {summary.readings.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-brand-700">
                Historie odečtů ({summary.readings.length})
              </summary>
              <div className="mt-2 flex flex-col gap-2">
                {summary.readings.map((reading) => (
                  <div key={reading.id} className="flex items-center gap-3 text-sm">
                    <span>
                      {number(reading.value)} {unit} · {date(reading.observedAt)}
                    </span>
                    {canEdit && (
                      <ActionButton
                        action={deleteMeterReading}
                        hidden={{ assetId, readingId: reading.id }}
                        label="Smazat"
                        variant="danger"
                        confirm={`Smazat odečet ${number(reading.value)} ${unit}? Stav se přepočítá podle předchozího odečtu.`}
                      />
                    )}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>

        <Table
          head={['Prohlídka', 'Interval', 'Poslední servis', 'Další hranice', 'Stav']}
          rows={summary.plans.map((plan) => [
            <span key="title" className="font-medium">
              {plan.title}
            </span>,
            `${number(plan.intervalUnits)} ${unit}${plan.intervalMonths ? ` / ${plan.intervalMonths} měs.` : ''}`,
            plan.lastService
              ? `${date(plan.lastService.performedAt)} · ${number(plan.lastService.meterValue ?? 0)} ${unit}`
              : '—',
            plan.nextMeter != null
              ? `${number(plan.nextMeter)} ${unit}${plan.nextDueAt ? ` / ${date(plan.nextDueAt)}` : ''}`
              : date(plan.nextDueAt),
            <Badge key="status" tone={STATUS[plan.status].tone}>
              {STATUS[plan.status].label}
            </Badge>,
          ])}
        />

        {canEdit &&
          summary.plans.map((plan) => (
            <details key={plan.code} className="rounded-xl border border-slate-200 p-4">
              <summary className="cursor-pointer font-medium text-brand-700">
                {plan.title}: zapsat prohlídku nebo upravit interval
              </summary>
              <p className="mt-2 text-sm text-slate-600">{plan.description}</p>
              <div className="mt-4 grid gap-6 lg:grid-cols-2">
                <div>
                  <h4 className="mb-2 text-sm font-semibold">Zapsat provedenou prohlídku</h4>
                  <ActionForm
                    action={completeMaintenance}
                    hidden={{ assetId, planCode: plan.code }}
                    submitLabel="Uložit prohlídku"
                    fields={[
                      {
                        name: 'performedAt',
                        label: 'Datum servisu',
                        type: 'date',
                        required: true,
                        defaultValue: today(),
                      },
                      {
                        name: 'meterValue',
                        label: `Stav při servisu (${unit})`,
                        type: 'number',
                        required: true,
                        min: 0,
                        max: 1000000000,
                        step: unit === 'mth' ? 0.1 : 1,
                        defaultValue: summary.currentReading?.value?.toString() ?? '',
                      },
                      { name: 'provider', label: 'Servis / technik' },
                      { name: 'note', label: 'Poznámka' },
                    ]}
                  />
                </div>
                <div>
                  <h4 className="mb-2 text-sm font-semibold">Upravit plán této položky</h4>
                  <ActionForm
                    action={updateMaintenanceRule}
                    hidden={{ assetId, code: plan.code }}
                    submitLabel="Uložit interval"
                    fields={[
                      {
                        name: 'intervalUnits',
                        label: `Každých (${unit})`,
                        type: 'number',
                        required: true,
                        min: 1,
                        max: 1000000,
                        step: 1,
                        defaultValue: String(plan.intervalUnits),
                      },
                      {
                        name: 'intervalMonths',
                        label: 'Nejpozději za (měsíců; nepovinné)',
                        type: 'number',
                        min: 1,
                        max: 120,
                        step: 1,
                        defaultValue: plan.intervalMonths?.toString() ?? '',
                      },
                      {
                        name: 'description',
                        label: 'Náplň prohlídky',
                        required: true,
                        defaultValue: plan.description,
                      },
                    ]}
                  />
                </div>
              </div>
            </details>
          ))}
        {summary.history.length > 0 && (
          <details className="rounded-xl border border-slate-200 p-4">
            <summary className="cursor-pointer font-medium text-brand-700">
              Historie prohlídek ({summary.history.length})
            </summary>
            <div className="mt-3">
              <Table
                head={['Datum', 'Prohlídka', 'Stav', 'Servis', 'Poznámka']}
                rows={summary.history.map((record) => [
                  date(record.performedAt),
                  summary.plans.find((plan) => plan.code === record.planCode)?.title ??
                    record.planCode ??
                    '—',
                  record.meterValue == null ? '—' : `${number(record.meterValue)} ${unit}`,
                  record.provider ?? '—',
                  record.note ?? '—',
                ])}
              />
            </div>
          </details>
        )}
        <p className="text-xs text-slate-500">
          Bez zapsaného posledního servisu nelze další hranici spolehlivě vypočítat. Zákonné revize
          a STK se řídí samostatnými předpisy, ne tímto orientačním plánem.
        </p>
      </div>
    </Section>
  );
}
