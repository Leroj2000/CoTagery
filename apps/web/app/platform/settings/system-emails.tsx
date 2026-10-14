'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import type { NotificationSettingView } from '../../lib/notifications';
import { TemplateEditor } from '../../admin/settings/notifications/template-editor';

/** Platforma: texty systémových e-mailů Tagery (ověření e-mailu, obnovení hesla). */
export function SystemEmails({ initial }: { initial: NotificationSettingView[] }) {
  const [items, setItems] = useState(initial);
  const [open, setOpen] = useState<string | null>(null);

  async function save(key: string, subject: string | null, body: string | null) {
    const res = await fetch(`/api/platform/notifications/${key}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subject, body }),
    });
    const json = (await res.json().catch(() => null)) as
      NotificationSettingView[] | { message?: string | string[] } | null;
    if (!res.ok || !Array.isArray(json)) {
      const m = json && !Array.isArray(json) ? json.message : null;
      return (Array.isArray(m) ? m.join(' ') : m) || `Chyba ${res.status}`;
    }
    setItems(json);
    return null;
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
      <div>
        <h2 className="text-sm font-semibold text-slate-800">Systémové e-maily</h2>
        <p className="text-xs text-slate-500">
          Texty, které nepatří žádné firmě. Pozvánku a provozní notifikace si upravují firmy samy.
        </p>
      </div>
      <ul className="flex flex-col divide-y divide-slate-100">
        {items.map((item) => (
          <li key={item.key} className="py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-slate-800">
                  {item.label}
                  {item.customized && (
                    <span className="ml-2 text-xs font-normal text-brand-700">upravený text</span>
                  )}
                </p>
                <p className="text-xs text-slate-500">{item.description}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(open === item.key ? null : item.key)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                <Pencil size={13} /> Upravit text
              </button>
            </div>
            {open === item.key && (
              <TemplateEditor
                key={`${item.key}:${item.subject}:${item.body}`}
                item={item}
                apiBase="/api/platform/notifications"
                onClose={() => setOpen(null)}
                onSaved={(subject, body) => save(item.key, subject, body)}
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
