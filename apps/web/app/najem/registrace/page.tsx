import { redirect } from 'next/navigation';
import { getRenter } from '../../lib/renter-session';
import { RenterAuthForm } from '../auth-form';

export const dynamic = 'force-dynamic';

export default async function RenterRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const target = next ?? '/najem/moje-vypujcky';
  if (await getRenter()) redirect(target);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Registrace nájemce</h1>
        <p className="mt-1 mb-5 text-sm text-slate-500">Vytvoř si účet pro půjčování napříč firmami.</p>
        <RenterAuthForm mode="register" next={target} />
      </div>
    </main>
  );
}
