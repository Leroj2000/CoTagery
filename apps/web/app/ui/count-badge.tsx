/**
 * Počítadlo v kolečku pro čekající položky (notifikace, „Vyžaduje pozornost",
 * nevyřízené požadavky…). Při 0 se nevykreslí; nad `max` ukáže „99+".
 *
 * - `inline` – vedle textu (položka navigace, nadpis sekce),
 * - `overlay` – v rohu ikony; rodič musí mít `relative`.
 */
export function CountBadge({
  count,
  max = 99,
  variant = 'inline',
  label,
  className = '',
}: {
  count: number;
  max?: number;
  variant?: 'inline' | 'overlay';
  /** Přístupný popis, např. „3 položky vyžadují pozornost". */
  label?: string;
  className?: string;
}) {
  if (count <= 0) return null;
  const text = count > max ? `${max}+` : String(count);
  const position =
    variant === 'overlay' ? 'absolute -right-2 -top-1.5 ring-2 ring-white' : 'shrink-0';
  return (
    <span
      role="status"
      aria-label={label ?? `${count} čekajících`}
      className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-semibold leading-none tabular-nums text-white ${position} ${className}`}
    >
      {text}
    </span>
  );
}
