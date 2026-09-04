'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { AlertCircle, Camera, CheckCircle2, Loader2, UserRound } from 'lucide-react';
import type { PersonCategory } from '../../lib/types';

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10';

/**
 * Formulář „Nová osoba" s volitelnou profilovou fotkou. Osoba se nejdřív vytvoří
 * (JSON přes BFF `/api/people`), pak se – pokud je vybraná fotka – nahraje na
 * její id (dvoukrok, mirror uploadu fotek u položek). `capture="environment"`
 * umožní vyfotit rovnou z mobilu.
 */
export function PersonForm({ categories = [] }: { categories?: PersonCategory[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [cats, setCats] = useState<string[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function toggleCat(id: string): void {
    setCats((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const f = e.target.files?.[0] ?? null;
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setPending(true);
    setError(null);
    setOk(false);
    try {
      const fd = new FormData(e.currentTarget);
      const body = {
        name: (fd.get('name') as string)?.trim(),
        email: ((fd.get('email') as string) || '').trim() || undefined,
        phone: ((fd.get('phone') as string) || '').trim() || undefined,
        company: ((fd.get('company') as string) || '').trim() || undefined,
        categoryIds: cats.length > 0 ? cats : undefined,
      };
      const res = await fetch('/api/people', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError('Vytvoření osoby selhalo.');
        return;
      }
      const person = (await res.json()) as { id: string };

      const file = fileRef.current?.files?.[0];
      if (file) {
        const pf = new FormData();
        pf.append('file', file);
        const up = await fetch(`/api/person-photo/${person.id}`, { method: 'POST', body: pf });
        if (!up.ok) {
          setError('Osoba vytvořena, ale nahrání fotky selhalo.');
          router.refresh();
          return;
        }
      }
      setOk(true);
      setPreview(null);
      setCats([]);
      formRef.current?.reset();
      router.refresh();
    } catch {
      setError('Neočekávaná chyba.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex flex-col items-center gap-2">
          <label
            className="relative flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-slate-300 bg-slate-50 text-slate-400 transition hover:border-brand-400"
            title="Nahrát / vyfotit"
          >
            {preview ? (
              <img src={preview} alt="" className="h-full w-full object-cover" />
            ) : (
              <UserRound size={30} />
            )}
            <span className="absolute bottom-0 right-0 rounded-full bg-brand-600 p-1 text-white">
              <Camera size={13} />
            </span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onFileChange}
              className="hidden"
            />
          </label>
          <span className="text-[11px] text-slate-400">Fotka (volitelné)</span>
        </div>

        <div className="grid flex-1 gap-4 sm:grid-cols-2">
          <Field label="Jméno" required>
            <input name="name" required className={inputCls} />
          </Field>
          <Field label="E-mail">
            <input name="email" type="email" className={inputCls} />
          </Field>
          <Field label="Telefon">
            <input name="phone" className={inputCls} />
          </Field>
          <Field label="Firma">
            <input name="company" className={inputCls} />
          </Field>
        </div>
      </div>

      {categories.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-slate-600">Kategorie (více možností)</span>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const on = cats.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCat(c.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition ${
                    on
                      ? 'border-brand-300 bg-brand-50 text-brand-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300'
                  }`}
                >
                  <span
                    className={`flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border ${
                      on ? 'border-brand-500 bg-brand-500 text-white' : 'border-slate-300'
                    }`}
                  >
                    {on && <CheckCircle2 size={10} />}
                  </span>
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {error && (
        <p className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-100">
          <AlertCircle size={15} /> {error}
        </p>
      )}
      {ok && (
        <p className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-100">
          <CheckCircle2 size={15} /> Osoba vytvořena.
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus:ring-4 focus:ring-brand-500/20 disabled:opacity-50"
        >
          {pending && <Loader2 size={15} className="animate-spin" />}
          {pending ? 'Ukládám…' : 'Vytvořit osobu'}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-slate-600">
        {label}
        {required && <span className="text-brand-600"> *</span>}
      </label>
      {children}
    </div>
  );
}
