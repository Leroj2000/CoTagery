import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiFetch, ApiError, getMe } from '../../../../../lib/server-api';
import type { Asset, ServiceRecord } from '../../../../../lib/types';
import { fmtDay, type PurchaseView, type Warranty } from '../../../../../lib/purchase';
import { PrintButton } from './print-button';

export const dynamic = 'force-dynamic';

function day(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('cs-CZ') : '—';
}

/** Den (YYYY-MM-DD) v Praze – pro porovnání se záručním obdobím. */
function pragueDay(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague' }).format(new Date(iso));
}

/**
 * Reklamační protokol (BACKLOG WAR-01) – tisknutelný podklad k reklamaci u
 * prodejce/výrobce. Vychází ze servisního záznamu (reklamace nebo oprava),
 * položky, dokladu o pořízení a záruky platné v den závady. Nic neodesílá.
 */
export default async function ClaimProtocolPage({
  params,
}: {
  params: Promise<{ id: string; serviceId: string }>;
}) {
  const { id, serviceId } = await params;
  let asset: Asset;
  try {
    asset = await apiFetch<Asset>(`/assets/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const [services, warranties, purchaseView, me] = await Promise.all([
    apiFetch<ServiceRecord[]>(`/assets/${id}/services`),
    apiFetch<Warranty[]>(`/assets/${id}/warranties`).catch(() => [] as Warranty[]),
    apiFetch<PurchaseView>(`/assets/${id}/purchase`).catch(() => null),
    getMe().catch(() => null),
  ]);
  const record = services.find((s) => s.id === serviceId);
  if (!record) notFound();

  const onDay = pragueDay(record.performedAt) ?? pragueDay(new Date().toISOString())!;
  const warranty =
    warranties.find((w) => (!w.startsOn || w.startsOn <= onDay) && onDay <= w.endsOn) ??
    warranties[0] ??
    null;
  const inWarranty = Boolean(warranty && (!warranty.startsOn || warranty.startsOn <= onDay) && onDay <= warranty.endsOn);
  const purchase = purchaseView?.purchase ?? null;
  const invoice = purchaseView?.documents.find((d) => d.docType === 'invoice') ?? null;

  const row = (label: string, value: React.ReactNode) => (
    <tr className="border-b border-slate-200">
      <th className="w-1/3 py-1.5 pr-4 text-left align-top font-medium text-slate-600">{label}</th>
      <td className="py-1.5 text-slate-900">{value || '—'}</td>
    </tr>
  );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 bg-white p-6 print:p-0">
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/admin/assets/${id}#servis`} className="text-sm text-brand-700 hover:underline">
          ← zpět na položku
        </Link>
        <PrintButton />
      </div>

      <header>
        <h1 className="text-xl font-semibold text-slate-900">Reklamační protokol</h1>
        <p className="text-sm text-slate-600">
          Vystaveno {day(new Date().toISOString())} v Tagery
          {me ? ` · ${me.user.name || me.user.email}` : ''}
        </p>
      </header>

      {!inWarranty && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 print:hidden">
          V den závady ({fmtDay(onDay)}) podle evidence neplatila žádná záruka – zkontroluj data záruky.
        </p>
      )}

      <section>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">Předmět reklamace</h2>
        <table className="w-full text-sm">
          <tbody>
            {row('Název', asset.name)}
            {row('Výrobce / model', [asset.manufacturer, asset.model].filter(Boolean).join(' '))}
            {row('Výrobní číslo', asset.serialNumber)}
            {row('Inventární číslo', asset.inventoryNumber)}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">Nákup a záruka</h2>
        <table className="w-full text-sm">
          <tbody>
            {row('Prodejce', purchase?.supplier)}
            {row('Datum nákupu', fmtDay(purchase?.purchasedOn ?? null))}
            {row('Číslo dokladu', purchase?.documentNumber ?? invoice?.fileName ?? null)}
            {row('Záruka', warranty ? warranty.title : null)}
            {row(
              'Záruční doba',
              warranty ? `${warranty.startsOn ? `${fmtDay(warranty.startsOn)} – ` : 'do '}${fmtDay(warranty.endsOn)}` : null,
            )}
            {row('Reklamaci vyřizuje', warranty?.provider ?? record.provider)}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">Závada</h2>
        <table className="w-full text-sm">
          <tbody>
            {row('Datum zjištění / opravy', day(record.performedAt))}
            {row('Popis závady', record.note)}
            {row('Požadované řešení', 'oprava / výměna v rámci záruky')}
          </tbody>
        </table>
      </section>

      <section className="grid grid-cols-2 gap-8 pt-10 text-sm text-slate-600">
        <div className="border-t border-slate-400 pt-1">Reklamující (podpis, datum)</div>
        <div className="border-t border-slate-400 pt-1">Převzal za prodejce/servis (podpis, datum)</div>
      </section>
    </div>
  );
}
