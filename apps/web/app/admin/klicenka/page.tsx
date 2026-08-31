import { KeyRound } from 'lucide-react';
import { PageHeader } from '../ui';

export const dynamic = 'force-dynamic';

/**
 * Klíčenka – rychlý přístup ke slevovým a přístupovým kódům (QR / čárový kód / NFC).
 * Zatím kostra; obsah a datový model se dolaďuje dle rozsahu.
 */
export default function KlicenkaPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Klíčenka"
        description="Slevové a přístupové kódy po ruce – QR, čárové kódy a NFC."
        icon={<KeyRound size={18} />}
      />
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <KeyRound size={28} className="mx-auto text-slate-300" />
        <p className="mt-3 text-sm font-medium text-slate-600">Klíčenka se připravuje</p>
        <p className="mx-auto mt-1 max-w-md text-xs text-slate-400">
          Tady budou tvoje slevové a přístupové kódy jako QR / čárový kód / NFC, připravené
          k rychlému ukázání či naskenování. Upřesňujeme rozsah (jaké kódy, odkud).
        </p>
      </div>
    </div>
  );
}
