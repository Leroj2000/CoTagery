/** Značka Tagery: SVG „tag" mark + volitelný wordmark. */
export function Logo({ size = 28, withText = true }: { size?: number; withText?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden
        className="shrink-0"
      >
        <rect width="32" height="32" rx="8" className="fill-brand-600" />
        {/* stylizovaný QR/tag glyph */}
        <rect x="7" y="7" width="7" height="7" rx="1.5" className="fill-white" />
        <rect x="18" y="7" width="7" height="7" rx="1.5" className="fill-white/70" />
        <rect x="7" y="18" width="7" height="7" rx="1.5" className="fill-white/70" />
        <circle cx="21.5" cy="21.5" r="3.5" className="fill-white" />
      </svg>
      {withText && (
        <span className="text-[17px] font-semibold tracking-tight text-slate-900">Tagery</span>
      )}
    </span>
  );
}
