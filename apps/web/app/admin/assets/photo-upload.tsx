'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';

/** Nahrání/výměna fotky věci přes BFF proxy (multipart s Bearer na serveru). */
export function PhotoUpload({ assetId, hasPhoto }: { assetId: string; hasPhoto: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/asset-photo/${assetId}`, { method: 'POST', body: fd });
      if (!res.ok) {
        setError('Nahrání selhalo.');
        return;
      }
      router.refresh();
    } catch {
      setError('Nahrání selhalo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
        {hasPhoto ? 'Vyměnit fotku' : 'Nahrát fotku'}
        <input type="file" accept="image/*" onChange={onFile} disabled={busy} className="hidden" />
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
