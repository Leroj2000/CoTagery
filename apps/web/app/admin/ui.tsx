import type { ReactNode } from 'react';

/** Sekce s nadpisem (server-safe, bez hooků). */
export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-neutral-600">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Jednoduchá tabulka. `rows` je pole polí buněk (ReactNode). */
export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-neutral-400">Zatím nic.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-xs uppercase text-neutral-400">
            {head.map((h) => (
              <th key={h} className="px-2 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} className="border-b border-neutral-100 last:border-0">
              {cells.map((c, j) => (
                <td key={j} className="px-2 py-2 align-top">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
      {children}
    </span>
  );
}

export function Mono({ children }: { children: ReactNode }) {
  return <span className="font-mono text-xs text-neutral-500">{children}</span>;
}
