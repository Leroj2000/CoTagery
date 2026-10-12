import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiFetch, ApiError } from '../../../lib/server-api';
import { fmtDay, type TenantDetail } from '../../../lib/platform';
import { PlatformShell, requirePlatformAdmin } from '../../platform-shell';
import { TenantEditor } from './tenant-editor';

export const dynamic = 'force-dynamic';

export default async function PlatformTenantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePlatformAdmin(`/platform/tenants/${id}`);
  let detail: TenantDetail;
  try {
    detail = await apiFetch<TenantDetail>(`/platform/tenants/${id}`);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 400)) notFound();
    throw e;
  }
  const t = detail.tenant;

  return (
    <PlatformShell active="/platform">
      <Link href="/platform" className="text-xs text-slate-500 hover:underline">
        ← Firmy
      </Link>
      <div className="mb-6 mt-1">
        <h1 className="text-xl font-semibold text-slate-900">{t.name}</h1>
        <p className="text-sm text-slate-500">
          {[
            t.slug && `/${t.slug}`,
            t.owner && `vlastník ${t.owner.name} (${t.owner.email})`,
            `založeno ${fmtDay(t.createdAt)}`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
      <TenantEditor detail={detail} />
    </PlatformShell>
  );
}
