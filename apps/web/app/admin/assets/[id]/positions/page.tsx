import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MapPinned } from 'lucide-react';
import { apiFetch, ApiError } from '../../../../lib/server-api';
import type { Asset, Observation } from '../../../../lib/types';
import { PageHeader } from '../../../ui';
import { ObservationHistory } from './observation-history';

export const dynamic = 'force-dynamic';

export default async function AssetPositionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let asset: Asset;
  try {
    asset = await apiFetch<Asset>(`/assets/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const observations = await apiFetch<Observation[]>(`/assets/${id}/observations?limit=50`);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/admin/assets/${id}`} className="text-xs text-slate-500 hover:underline">
          ← {asset.name}
        </Link>
        <div className="mt-1">
          <PageHeader
            title="Historie poloh"
            description={`Kde a kdy byla položka ${asset.name} fyzicky zaznamenána`}
            icon={<MapPinned size={18} />}
          />
        </div>
      </div>
      <ObservationHistory assetId={id} observations={observations} />
    </div>
  );
}
