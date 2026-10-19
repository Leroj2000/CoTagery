import Link from 'next/link';
import { PAGE_NOT_FOUND } from './lib/not-found-copy';

/** Obecná 404 v češtině (místo výchozí anglické stránky Next.js). */
export default function NotFound() {
  const c = PAGE_NOT_FOUND;
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="flex max-w-md flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-card">
        <p className="text-4xl font-bold text-slate-300">404</p>
        <h1 className="text-lg font-semibold text-slate-900">{c.title}</h1>
        <p className="text-sm text-slate-600">{c.lead}</p>
        <Link href={c.back.href} className="text-sm font-medium text-brand-700 hover:underline">
          {c.back.label}
        </Link>
      </div>
    </main>
  );
}
