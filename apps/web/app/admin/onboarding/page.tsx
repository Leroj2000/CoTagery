import Link from 'next/link';
import { CheckCircle2, Circle, MapPin, Package, QrCode, ScanLine } from 'lucide-react';
import { apiFetch } from '../../lib/server-api';
import type { Asset, Location } from '../../lib/types';
import { PageHeader } from '../ui';

export const dynamic = 'force-dynamic';

interface Overview {
  totalScans: number;
}

export default async function OnboardingPage() {
  const [locations, assets, assigned, overview] = await Promise.all([
    apiFetch<Location[]>('/locations'),
    apiFetch<Asset[]>('/assets'),
    apiFetch<string[]>('/carriers/assigned-object-ids'),
    apiFetch<Overview>('/analytics/overview'),
  ]);
  const tagged = assets.some((a) => assigned.includes(a.digitalObjectId));
  const steps = [
    {
      done: true,
      title: 'Firma a účet',
      text: 'Organizace je založená a e-mail ověřený.',
      href: '/admin/settings',
      icon: CheckCircle2,
    },
    {
      done: locations.length > 0,
      title: 'Vytvořte místo',
      text: 'Například sklad, kancelář nebo regál.',
      href: '/admin/locations',
      icon: MapPin,
    },
    {
      done: assets.length > 0,
      title: 'Přidejte první položku',
      text: 'Pojmenujte věc a přiřaďte jí domovské místo.',
      href: '/admin/assets',
      icon: Package,
    },
    {
      done: tagged,
      title: 'Přidejte QR štítek',
      text: 'Na detailu položky vytvořte QR identifikátor.',
      href: assets[0] ? `/admin/assets/${assets[0].id}` : '/admin/assets',
      icon: QrCode,
    },
    {
      done: overview.totalScans > 0,
      title: 'Proveďte první sken',
      text: 'Otevřete skener a načtěte vytištěný nebo zobrazený kód.',
      href: '/admin/scan',
      icon: ScanLine,
    },
  ];
  const completed = steps.filter((s) => s.done).length;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="První kroky"
        description="Od nové firmy k první označené a naskenované věci."
      />
      <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4">
        <p className="font-semibold text-brand-900">
          Hotovo {completed} z {steps.length}
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded bg-white">
          <div
            className="h-full bg-brand-600"
            style={{ width: `${(completed / steps.length) * 100}%` }}
          />
        </div>
      </div>
      <ol className="space-y-3">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <li
              key={step.title}
              className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-card"
            >
              {step.done ? (
                <CheckCircle2 className="text-emerald-600" />
              ) : (
                <Circle className="text-slate-300" />
              )}
              <Icon className="text-brand-600" />
              <div className="flex-1">
                <p className="font-semibold">
                  {i + 1}. {step.title}
                </p>
                <p className="text-sm text-slate-500">{step.text}</p>
              </div>
              <Link
                href={step.href}
                className="rounded-lg border px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
              >
                {step.done ? 'Zobrazit' : 'Pokračovat'}
              </Link>
            </li>
          );
        })}
      </ol>
      {completed === steps.length && (
        <div className="rounded-2xl bg-emerald-50 p-5 text-emerald-800">
          <strong>Onboarding je dokončený.</strong> Vaše první věc je označená a ověřená skenem.
        </div>
      )}
    </div>
  );
}
