/** Volby do selectů (sdíleno mezi admin formuláři). */

export const MODULE_OPTIONS = [
  'product',
  'membership',
  'ticket',
  'rental',
  'gallery',
  'contact',
  'loyalty',
  'pay',
  'inventory',
  'trace',
  'time_tracker',
  'automation',
  'access_point',
].map((v) => ({ value: v, label: v }));

export const ROLE_OPTIONS = ['ADMIN', 'MANAGER', 'EDITOR', 'VIEWER', 'SCAN_ONLY'].map((v) => ({
  value: v,
  label: v,
}));

export const BENEFIT_KIND_OPTIONS = [
  { value: 'discount_percent', label: 'Sleva (%)' },
  { value: 'special_price', label: 'Speciální cena' },
  { value: 'free', label: 'Zdarma' },
  { value: 'zone_access', label: 'Vstup do zóny' },
];
