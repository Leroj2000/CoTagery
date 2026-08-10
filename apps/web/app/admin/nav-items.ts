/** Položky admin navigace (sdíleno server dashboardem i client nav). */
export const NAV_ITEMS = [
  { href: '/admin', label: 'Přehled' },
  { href: '/admin/objects', label: 'Objekty a nosiče' },
  { href: '/admin/membership', label: 'Členství' },
  { href: '/admin/billing', label: 'Předplatné' },
  { href: '/admin/access', label: 'Přístup' },
] as const;
