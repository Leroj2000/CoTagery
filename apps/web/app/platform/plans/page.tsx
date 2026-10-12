import { apiFetch } from '../../lib/server-api';
import type { PlanDefinition } from '../../lib/platform';
import { PlatformShell, requirePlatformAdmin } from '../platform-shell';
import { PlanEditor } from './plan-editor';

export const dynamic = 'force-dynamic';

export default async function PlatformPlansPage() {
  await requirePlatformAdmin('/platform/plans');
  const plans = await apiFetch<PlanDefinition[]>('/platform/plans');
  return (
    <PlatformShell active="/platform/plans">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Úrovně předplatného</h1>
        <p className="text-sm text-slate-500">
          Ceník, limity a moduly jednotlivých úrovní. Změna se hned projeví u všech firem na dané
          úrovni (výjimky pro jednotlivé firmy se nastavují v jejich detailu). „Zkušební" platí pro
          nové firmy po dobu zkušební doby, po ní firma přejde na Free.
        </p>
      </div>
      <div className="flex flex-col gap-6">
        {plans.map((p) => (
          <PlanEditor key={p.key} plan={p} />
        ))}
      </div>
    </PlatformShell>
  );
}
