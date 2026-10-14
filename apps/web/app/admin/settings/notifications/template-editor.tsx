'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, RotateCcw, Send } from 'lucide-react';
import type { EmailPreview, NotificationSettingView } from '../../../lib/notifications';

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10';
const secondaryBtn =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50';

async function json<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => null)) as T & { message?: string | string[] };
  if (!res.ok) {
    const m = data?.message;
    throw new Error((Array.isArray(m) ? m.join(' ') : m) || `Chyba ${res.status}`);
  }
  return data;
}

/**
 * Editor textu e-mailové notifikace: předmět, text s proměnnými (klik vloží do
 * textu), živý náhled, uložení, obnovení výchozího a zkušební e-mail na vlastní
 * adresu. `apiBase` = `/api/notifications` (firma) nebo `/api/platform/notifications`.
 */
export function TemplateEditor({
  item,
  apiBase,
  onSaved,
  onClose,
  readOnly = false,
}: {
  item: NotificationSettingView;
  apiBase: string;
  /** Uložení (null = výchozí text). Vrací chybu, nebo null. */
  onSaved: (subject: string | null, body: string | null) => Promise<string | null>;
  onClose: () => void;
  readOnly?: boolean;
}) {
  const [subject, setSubject] = useState(item.subject);
  const [body, setBody] = useState(item.body);
  const [preview, setPreview] = useState<EmailPreview | null>(null);
  const [busy, setBusy] = useState<'save' | 'reset' | 'test' | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Živý náhled (s krátkým zpožděním po psaní).
  useEffect(() => {
    const t = setTimeout(() => {
      void fetch(`${apiBase}/${item.key}/preview`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subject, body }),
      })
        .then((r) => json<EmailPreview>(r))
        .then(setPreview)
        .catch(() => undefined);
    }, 350);
    return () => clearTimeout(t);
  }, [apiBase, item.key, subject, body]);

  function insert(variable: string) {
    const token = `{{${variable}}}`;
    const el = bodyRef.current;
    if (!el) return setBody((b) => b + token);
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function save(reset = false) {
    setBusy(reset ? 'reset' : 'save');
    setMsg(null);
    const err = await onSaved(reset ? null : subject, reset ? null : body);
    setBusy(null);
    if (err) setMsg({ ok: false, text: err });
    else if (reset) {
      setSubject(item.defaultSubject);
      setBody(item.defaultBody);
      setMsg({ ok: true, text: 'Obnoven výchozí text.' });
    } else setMsg({ ok: true, text: 'Uloženo.' });
  }

  async function test() {
    setBusy('test');
    setMsg(null);
    try {
      const r = await json<{ to: string; status: string }>(
        await fetch(`${apiBase}/${item.key}/test`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ subject, body }),
        }),
      );
      setMsg({
        ok: r.status !== 'failed',
        text:
          r.status === 'failed'
            ? `Odeslání na ${r.to} selhalo.`
            : `Zkušební e-mail odeslán na ${r.to}.`,
      });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const errors = preview?.errors ?? [];

  return (
    <div className="mt-3 grid gap-4 rounded-xl bg-slate-50 p-4 lg:grid-cols-2">
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-slate-600">Předmět</span>
          <input
            className={inputCls}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            readOnly={readOnly}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-slate-600">Text</span>
          <textarea
            ref={bodyRef}
            className={`${inputCls} min-h-[220px] font-mono text-[13px] leading-relaxed`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            readOnly={readOnly}
          />
        </label>
        <p className="text-xs text-slate-500">
          Odstavce odděl prázdným řádkem. Odkaz nebo tlačítko:{' '}
          <code>[Text](&#123;&#123;odkaz&#125;&#125;)</code>.
        </p>
        {!readOnly && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-600">Proměnné (klikem vložíš)</span>
            <div className="flex flex-wrap gap-1.5">
              {item.variables.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => insert(v.key)}
                  title={`Např. ${v.example}`}
                  className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-brand-50 hover:ring-brand-300"
                >
                  {v.label}{' '}
                  <code className="text-slate-400">
                    {'{{'}
                    {v.key}
                    {'}}'}
                  </code>
                  {item.requiredVariables.includes(v.key) && (
                    <span className="text-brand-600"> *</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
        {errors.length > 0 && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-100">
            {errors.join(' ')}
          </p>
        )}
        {msg && (
          <p className={`text-sm ${msg.ok ? 'text-emerald-700' : 'text-red-700'}`}>{msg.text}</p>
        )}
        <div className="flex flex-wrap gap-2">
          {!readOnly && (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
              disabled={!!busy || errors.length > 0}
              onClick={() => void save()}
            >
              {busy === 'save' && <Loader2 size={14} className="animate-spin" />} Uložit text
            </button>
          )}
          {!readOnly && item.customized && (
            <button
              type="button"
              className={secondaryBtn}
              disabled={!!busy}
              onClick={() => void save(true)}
            >
              {busy === 'reset' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RotateCcw size={14} />
              )}
              Výchozí text
            </button>
          )}
          <button
            type="button"
            className={secondaryBtn}
            disabled={!!busy || errors.length > 0}
            onClick={() => void test()}
          >
            {busy === 'test' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Poslat zkušební na můj e-mail
          </button>
          <button type="button" className={secondaryBtn} onClick={onClose}>
            Zavřít
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-slate-600">Náhled (s ukázkovými údaji)</span>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-2 text-sm">
            <span className="text-slate-400">Předmět: </span>
            <span className="font-medium text-slate-800">{preview?.subject ?? '…'}</span>
          </div>
          {/* Sandbox: HTML z rendereru je escapovaný, iframe navíc bez skriptů. */}
          <iframe
            title="Náhled e-mailu"
            sandbox=""
            srcDoc={preview?.html ?? ''}
            className="h-[320px] w-full"
          />
        </div>
      </div>
    </div>
  );
}
