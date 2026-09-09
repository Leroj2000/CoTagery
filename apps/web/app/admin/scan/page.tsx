import { ScanLine } from 'lucide-react';
import { PageHeader } from '../ui';
import { ScanClient } from './scan-client';
import { apiFetch } from '../../lib/server-api';
import type { Location } from '../../lib/types';

export const dynamic = 'force-dynamic';

export default async function ScanPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const locations = await apiFetch<Location[]>('/locations').catch(() => null);
  const { code } = await searchParams;
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <PageHeader
        title="Sken"
        description="Naskenuj QR / čárový kód (náš i adoptovaný) → položka, stav a co s ní teď udělat."
        icon={<ScanLine size={18} />}
      />
      <ScanClient
        initialCode={code ?? ''}
        locations={locations?.map(({ id, name }) => ({ id, name })) ?? []}
        locationsAvailable={locations !== null}
      />
    </div>
  );
}
