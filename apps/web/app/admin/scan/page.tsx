import { ScanLine } from 'lucide-react';
import { PageHeader } from '../ui';
import { ScanClient } from './scan-client';
import { apiFetch } from '../../lib/server-api';
import type { Location } from '../../lib/types';
import { locationPath } from '../../lib/location-path';

export const dynamic = 'force-dynamic';

export default async function ScanPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; auto?: string }>;
}) {
  const locations = await apiFetch<Location[]>('/locations').catch(() => null);
  const { code, auto } = await searchParams;
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <PageHeader
        title="Identifikovat"
        description="Zjisti, co držíš v ruce a kde věc patří. Načtení samo nepotvrzuje převzetí ani vstup."
        icon={<ScanLine size={18} />}
      />
      <ScanClient
        initialCode={code ?? ''}
        autoStart={auto === '1'}
        locations={locations?.map(({ id }) => ({ id, name: locationPath(id, locations) })) ?? []}
        locationsAvailable={locations !== null}
      />
    </div>
  );
}
