/** Položky admin navigace (sdíleno server dashboardem i client nav). */
export const NAV_ITEMS = [
  { href: '/admin', label: 'Přehled' },
  { href: '/admin/objects', label: 'Objekty' },
  { href: '/admin/carriers', label: 'Nosiče (pool)' },
  { href: '/admin/membership', label: 'Členství' },
  { href: '/admin/billing', label: 'Předplatné' },
  { href: '/admin/access', label: 'Přístup' },
  { href: '/admin/users', label: 'Uživatelé' },
  { href: '/admin/groups', label: 'Skupiny' },
] as const;
