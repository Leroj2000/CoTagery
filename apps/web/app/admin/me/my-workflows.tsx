'use client';
import { useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { CodeInput } from '../scan/code-input';
type Handoff = {
  id: string;
  assetId: string;
  assetName: string;
  incoming: boolean;
  status: string;
  recipientName: string;
};
export function MyWorkflows({ handoffs }: { handoffs: Handoff[] }) {
  const [items, setItems] = useState(handoffs);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const requestIds = useRef(new Map<string, string>());
  async function confirm(item: Handoff, code: string) {
    const requestId = requestIds.current.get(item.id) ?? crypto.randomUUID();
    requestIds.current.set(item.id, requestId);
    try {
      const res = await fetch(`/api/personal-workflows/handoffs/${item.id}/confirm`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ requestId, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setDone(data.message);
      setItems((current) => current.filter((x) => x.id !== item.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Potvrzení selhalo.');
    }
  }
  return (
    <div className="space-y-3">
      {items
        .filter((x) => x.incoming && x.status === 'pending')
        .map((item) => (
          <div key={item.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="font-semibold">Převezmi: {item.assetName}</p>
            <p className="mt-1 text-sm text-amber-900">
              Načti identifikátor této položky. Běžné hledání převzetí nepotvrzuje.
            </p>
            <CodeInput
              label="Načti identifikátor položky k potvrzení"
              onRead={(code) => void confirm(item, code)}
            />
          </div>
        ))}
      {done && (
        <p role="status" className="flex items-center gap-2 text-sm text-emerald-700">
          <CheckCircle2 size={16} />
          {done}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {!items.some((x) => x.incoming && x.status === 'pending') && (
        <p className="text-sm text-slate-500">Žádné připravené předání k potvrzení.</p>
      )}
    </div>
  );
}
