import {
  TIRE_AXLE_LABELS,
  TIRE_SEASON_LABELS,
  formatTireSize,
  type AssetTireView,
} from '@tagery/shared';
import { Badge, Section } from '../../ui';
import { ActionForm, type Field } from '../../action-form';
import { ActionButton } from '../../action-button';
import { addTire, deleteTire, mountTireSet, updateTire } from '../../actions';
import { groupTireSets } from '../../../lib/tires';
import { NO_PERMISSION_NOTE } from '../../../lib/abilities';

const SEASON_TONE = {
  summer: 'amber',
  winter: 'brand',
  all_season: 'green',
  construction: 'slate',
  industrial: 'slate',
} as const;

function tireFields(row?: AssetTireView): Field[] {
  const v = (x: string | number | null | undefined) => (x == null ? '' : String(x));
  return [
    {
      name: 'setLabel',
      label: 'Sada',
      required: true,
      placeholder: 'Zimní',
      defaultValue: row?.setLabel,
    },
    {
      name: 'season',
      label: 'Sezóna',
      required: true,
      defaultValue: row?.season ?? 'summer',
      options: Object.entries(TIRE_SEASON_LABELS).map(([value, label]) => ({ value, label })),
    },
    {
      name: 'axle',
      label: 'Náprava',
      defaultValue: row?.axle ?? 'all',
      options: Object.entries(TIRE_AXLE_LABELS).map(([value, label]) => ({ value, label })),
    },
    {
      name: 'width',
      label: 'Šířka (mm)',
      type: 'number',
      required: true,
      min: 3,
      placeholder: '205',
      defaultValue: v(row?.width),
    },
    {
      name: 'aspectRatio',
      label: 'Profil (%)',
      type: 'number',
      min: 10,
      placeholder: '55',
      defaultValue: v(row?.aspectRatio),
    },
    {
      name: 'rimDiameter',
      label: 'Ráfek (″)',
      type: 'number',
      required: true,
      step: 0.5,
      placeholder: '16',
      defaultValue: v(row?.rimDiameter),
    },
    {
      name: 'construction',
      label: 'Konstrukce',
      defaultValue: row?.construction ?? 'R',
      options: [
        { value: 'R', label: 'R (radiální)' },
        { value: 'D', label: 'D (diagonální)' },
      ],
    },
    {
      name: 'loadIndex',
      label: 'Index nosnosti',
      placeholder: '91',
      defaultValue: v(row?.loadIndex),
    },
    {
      name: 'speedIndex',
      label: 'Index rychlosti',
      placeholder: 'V',
      defaultValue: v(row?.speedIndex),
    },
    { name: 'brand', label: 'Značka', defaultValue: v(row?.brand) },
    { name: 'dot', label: 'DOT (TTRR)', placeholder: '2423', defaultValue: v(row?.dot) },
    {
      name: 'treadDepthMm',
      label: 'Dezén (mm)',
      type: 'number',
      step: 0.1,
      defaultValue: v(row?.treadDepthMm),
    },
    {
      name: 'quantity',
      label: 'Počet ks',
      type: 'number',
      min: 1,
      defaultValue: v(row?.quantity ?? 4),
    },
    { name: 'note', label: 'Poznámka', defaultValue: v(row?.note) },
  ];
}

/** Sekce Pneumatiky (vozidla/stroje): sady s nápravami, přezutí, správa řádků. */
export function TiresPanel({
  assetId,
  tires,
  canEdit,
}: {
  assetId: string;
  tires: AssetTireView[];
  canEdit: boolean;
}) {
  const sets = groupTireSets(tires);
  return (
    <Section title="Pneumatiky" description="Sady pneumatik – rozměry po nápravách, přezutí">
      <div className="flex flex-col gap-3">
        {sets.length === 0 && <p className="text-sm text-slate-400">Zatím žádné pneumatiky.</p>}
        <div className="grid gap-3 md:grid-cols-2">
          {sets.map((s) => (
            <div
              key={s.label}
              className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-800">{s.label}</span>
                <Badge tone={SEASON_TONE[s.season]}>{TIRE_SEASON_LABELS[s.season]}</Badge>
                {s.mounted && <Badge tone="green">Namontováno</Badge>}
                {canEdit && !s.mounted && (
                  <span className="ml-auto">
                    <ActionButton
                      action={mountTireSet}
                      hidden={{ assetId, setLabel: s.label }}
                      label="Přezout na tuto sadu"
                    />
                  </span>
                )}
              </div>
              <ul className="flex flex-col gap-1 text-sm">
                {s.rows.map((r) => (
                  <li key={r.id} className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-xs text-slate-500">{TIRE_AXLE_LABELS[r.axle]}</span>
                      <span className="font-mono font-medium text-slate-900">
                        {formatTireSize(r)}
                      </span>
                      <span className="text-xs text-slate-500">
                        {[
                          `${r.quantity} ks`,
                          r.brand,
                          r.dot && `DOT ${r.dot}`,
                          r.treadDepthMm != null && `dezén ${r.treadDepthMm} mm`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </div>
                    {r.note && <p className="text-xs text-slate-500">{r.note}</p>}
                    {canEdit && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-brand-700">Upravit</summary>
                        <div className="mt-2 flex flex-col gap-2">
                          <ActionForm
                            action={updateTire}
                            hidden={{ assetId, tireId: r.id }}
                            submitLabel="Uložit pneumatiky"
                            fields={tireFields(r)}
                          />
                          <ActionButton
                            action={deleteTire}
                            hidden={{ assetId, tireId: r.id }}
                            label="Smazat řádek"
                            variant="danger"
                            confirm="Smazat tento řádek pneumatik?"
                          />
                        </div>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {canEdit ? (
          <details className="rounded-xl border border-dashed border-slate-300 p-3">
            <summary className="cursor-pointer text-sm font-medium text-brand-700">
              Přidat pneumatiky (sada / náprava)
            </summary>
            <div className="mt-3">
              <ActionForm
                action={addTire}
                hidden={{ assetId }}
                submitLabel="Přidat pneumatiky"
                fields={[
                  ...tireFields(),
                  {
                    name: 'mounted',
                    label: 'Namontováno',
                    defaultValue: 'no',
                    options: [
                      { value: 'no', label: 'Ne (uskladněno)' },
                      { value: 'yes', label: 'Ano – na kolech' },
                    ],
                  },
                ]}
              />
            </div>
          </details>
        ) : (
          <p className="text-xs text-slate-500">{NO_PERMISSION_NOTE}</p>
        )}
      </div>
    </Section>
  );
}
