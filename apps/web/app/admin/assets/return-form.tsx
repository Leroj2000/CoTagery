'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Undo2, Loader2, Camera, AlertCircle } from 'lucide-react';

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10';

/**
 * Vrácení věci s fotkou stavu. Když je foto povinné (politika tenanta), bez něj
 * nejde odeslat. Posílá multipart na BFF /api/asset-return.
 */
export function ReturnForm({ assetId, requirePhoto }: { assetId: string; requirePhoto: boolean }) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (requirePhoto && files.length === 0) {
      setError('Vrácení vyžaduje fotku stavu.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      if (note) fd.append('note', note);
      for (const f of files) fd.append('files', f);
      const res = await fetch(`/api/asset-return/${assetId}`, { method: 'POST', body: fd });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { message?: string };
        setError(b.message ?? 'Vrácení selhalo.');
        return;
      }
      router.refresh();
    } catch {
      setError('Vrácení selhalo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-slate-600">Poznámka (volitelné)</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-slate-600">
          Foto stavu při vrácení {requirePhoto ? <span className="text-brand-600">(povinné)</span> : '(volitelné)'}
        </label>
        <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">
          <Camera size={15} /> Vybrat foto{files.length > 0 ? ` (${files.length})` : ''}
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="hidden"
          />
        </label>
      </div>
      {error && (
        <p className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle size={15} /> {error}
        </p>
      )}
      <div>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Undo2 size={15} />}
          {busy ? 'Vracím…' : 'Vrátit věc'}
        </button>
      </div>
    </form>
  );
}
