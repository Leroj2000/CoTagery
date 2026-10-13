import { ShieldOff } from 'lucide-react';

/** Stránka, kterou role nesmí otevřít (přímý odkaz) – místo chyby serveru. */
export function NoAccess({ what }: { what?: string }) {
  return (
    <div className="mx-auto mt-10 flex max-w-md flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card">
      <ShieldOff size={28} className="text-slate-400" />
      <h1 className="text-base font-semibold text-slate-800">Sem nemáš přístup</h1>
      <p className="text-sm text-slate-500">
        {what ? `${what} – tvoje role` : 'Tvoje role'} k tomu nemá oprávnění. Pokud ho potřebuješ,
        požádej vlastníka nebo správce firmy.
      </p>
    </div>
  );
}
