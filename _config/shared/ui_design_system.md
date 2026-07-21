# UI Design System (Vrstva 3 – NEMĚNNÉ)

## Mobile-first pravidla

### Breakpointy (Tailwind)
- `default` (≥0px) – mobilní layout, primární
- `sm` (≥640px) – větší telefony
- `md` (≥768px) – tablety
- `lg` (≥1024px) – desktop

**Vždy piš styly od mobile, rozšiřuj pro větší obrazovky.**

```tsx
// SPRÁVNĚ
<div className="flex flex-col md:flex-row">

// ŠPATNĚ – desktop first
<div className="flex flex-row md:flex-col">
```

### Typografie
- Nadpisy: `text-xl font-semibold` (mobile) → `text-2xl` (desktop)
- Tělo: `text-sm` (mobile) → `text-base` (desktop)
- Minimální font-size: 14px (žádný `text-xs` pro obsah)

### Dotykové cíle
- Minimální velikost interaktivních prvků: 44×44px
- Použij `min-h-[44px] min-w-[44px]` pro buttons/links

### Barvy
<!-- Doplň design token systém -->
- Primary: –
- Secondary: –
- Danger: –
- Success: –

### Komponenty
- Buttons: vždy s `focus-visible:ring` pro přístupnost
- Forms: `label` povinný pro každý input
- Ikony: doprovázeny `aria-label` nebo viditelným textem
