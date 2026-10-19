import Link from 'next/link';
import { ASSET_NOT_FOUND } from '../../../lib/not-found-copy';

/** 404 detailu položky (uvnitř admin layoutu – přepínač firmy je k dispozici). */
export default function AssetNotFound() {
  const c = ASSET_NOT_FOUND;
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
      <h1 className="text-lg font-semibold text-slate-900">{c.title}</h1>
      <p className="text-sm text-slate-600">{c.lead}</p>
      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
        {c.hints.map((h) => (
          <li key={h}>{h}</li>
        ))}
      </ul>
      <Link
        href={c.back.href}
        className="self-start rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
      >
        {c.back.label}
      </Link>
    </div>
  );
}
