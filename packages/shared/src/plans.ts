/**
 * Předplatné firem vůči Tagery (EPIC-20, ADR-0009) – katalog klíčů sdílený API
 * a webem. Úrovně (plány) a jejich limity/moduly jsou v DB (`platform_plans`,
 * mění je superadmin); tady jsou jen klíče, popisky a výchozí hodnoty.
 */

/** Rozšíření (produktové moduly) – vypínají se celé (navigace i API). */
export const PLAN_MODULES = [
  { key: 'rental', label: 'Půjčovna', description: 'Půjčování věcí, objednávky, smlouvy.' },
  { key: 'product', label: 'Produktové karty', description: 'Veřejné karty produktů.' },
  { key: 'membership', label: 'Členství', description: 'Klubová a nákupní členství, karty.' },
  { key: 'ticketing', label: 'Vstupenky', description: 'Akce, vstupenky, check-in.' },
  { key: 'gallery', label: 'Sdílené galerie', description: 'Galerie fotek a videí z akcí.' },
  { key: 'access', label: 'Řízení přístupu', description: 'Zóny, přístupové body, vstupy.' },
  { key: 'billing', label: 'Předplatné členů', description: 'Opakované platby členů klubu.' },
] as const;

/** Funkce uvnitř Tagery Věcí – stupňují základní produkt. */
export const PLAN_FEATURES = [
  { key: 'inventory', label: 'Inventury', description: 'Inventura skladu skenováním.' },
  {
    key: 'vehicles',
    label: 'Vozidla a stroje',
    description: 'Tachometr, servisní intervaly, inventura vozidel.',
  },
  { key: 'purchase', label: 'Pořízení a záruky', description: 'Ceny, doklady, záruky.' },
  {
    key: 'import_export',
    label: 'Import a export',
    description: 'Excel/CSV import a export položek, exporty inventur.',
  },
  { key: 'ai', label: 'AI dohledání', description: 'Návody a specifikace dohledané přes AI.' },
  { key: 'custom_roles', label: 'Vlastní role', description: 'Úprava rolí a oprávnění firmy.' },
  { key: 'branding', label: 'Logo firmy', description: 'Logo v QR kódech a na štítcích.' },
] as const;

export type PlanModuleKey = (typeof PLAN_MODULES)[number]['key'];
export type PlanFeatureKey = (typeof PLAN_FEATURES)[number]['key'];
/** Řízený klíč (modul nebo funkce) – stejně se zapíná, vypíná i vynucuje. */
export type EntitlementKey = PlanModuleKey | PlanFeatureKey;

export const ENTITLEMENT_KEYS: EntitlementKey[] = [
  ...PLAN_MODULES.map((m) => m.key),
  ...PLAN_FEATURES.map((f) => f.key),
];

export const PLAN_LIMITS = [
  { key: 'assets', label: 'Položky', unit: '' },
  { key: 'users', label: 'Uživatelé', unit: '' },
  { key: 'carriers', label: 'Identifikátory (QR/NFC)', unit: '' },
  { key: 'locations', label: 'Místa', unit: '' },
  { key: 'storage_mb', label: 'Úložiště (MB)', unit: 'MB' },
  { key: 'ai_per_month', label: 'AI dotazy za měsíc', unit: '' },
] as const;

export type LimitKey = (typeof PLAN_LIMITS)[number]['key'];
export const LIMIT_KEYS: LimitKey[] = PLAN_LIMITS.map((l) => l.key);

/** `null` = neomezeno. */
export type PlanLimits = Partial<Record<LimitKey, number | null>>;

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'suspended' | 'canceled';

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trialing: 'Zkušební doba',
  active: 'Aktivní',
  past_due: 'Po splatnosti',
  suspended: 'Pozastaveno',
  canceled: 'Zrušeno',
};

/** Úroveň předplatného (řádek `platform_plans`). */
export interface PlanDefinition {
  key: string;
  name: string;
  description: string | null;
  sortOrder: number;
  /** Cena bez DPH za měsíc / rok; `null` = individuálně. */
  priceMonth: number | null;
  priceYear: number | null;
  currency: string;
  /** Zapnuté moduly a funkce. */
  entitlements: EntitlementKey[];
  limits: PlanLimits;
  /** Nabízet firmám (ne trial a interní plány). */
  isPublic: boolean;
}

/** Výchozí úrovně (seed migrace; dál je mění superadmin v Platformě). */
export const DEFAULT_PLANS: PlanDefinition[] = [
  {
    key: 'trial',
    name: 'Zkušební',
    description: 'Zkušební doba nové firmy, po jejím konci přechod na Free.',
    sortOrder: 0,
    priceMonth: 0,
    priceYear: null,
    currency: 'CZK',
    entitlements: [
      'inventory',
      'vehicles',
      'purchase',
      'import_export',
      'ai',
      'custom_roles',
      'branding',
      'rental',
    ],
    limits: {
      assets: 500,
      users: 5,
      carriers: 1000,
      locations: 50,
      storage_mb: 5120,
      ai_per_month: 20,
    },
    isPublic: false,
  },
  {
    key: 'free',
    name: 'Free',
    description: 'Základní evidence pro malé týmy.',
    sortOrder: 1,
    priceMonth: 0,
    priceYear: 0,
    currency: 'CZK',
    entitlements: ['inventory'],
    limits: { assets: 50, users: 2, carriers: 100, locations: 5, storage_mb: 500, ai_per_month: 0 },
    isPublic: true,
  },
  {
    key: 'start',
    name: 'Start',
    description: 'Evidence, inventury a import pro menší firmy.',
    sortOrder: 2,
    priceMonth: 290,
    priceYear: 2900,
    currency: 'CZK',
    entitlements: ['inventory', 'import_export', 'branding'],
    limits: {
      assets: 500,
      users: 5,
      carriers: 1000,
      locations: 50,
      storage_mb: 5120,
      ai_per_month: 20,
    },
    isPublic: true,
  },
  {
    key: 'pro',
    name: 'Pro',
    description: 'Vozidla, pořízení a záruky, AI a vlastní role.',
    sortOrder: 3,
    priceMonth: 790,
    priceYear: 7900,
    currency: 'CZK',
    entitlements: [
      'inventory',
      'vehicles',
      'purchase',
      'import_export',
      'ai',
      'custom_roles',
      'branding',
      'rental',
    ],
    limits: {
      assets: 5000,
      users: 25,
      carriers: 10000,
      locations: null,
      storage_mb: 51200,
      ai_per_month: 200,
    },
    isPublic: true,
  },
  {
    key: 'business',
    name: 'Business',
    description: 'Vše bez limitů, cena individuálně.',
    sortOrder: 4,
    priceMonth: null,
    priceYear: null,
    currency: 'CZK',
    entitlements: [...ENTITLEMENT_KEYS],
    limits: {
      assets: null,
      users: null,
      carriers: null,
      locations: null,
      storage_mb: null,
      ai_per_month: null,
    },
    isPublic: true,
  },
];

/** Klíč úrovně, na kterou firma spadne po zkušební době / pozastavení. */
export const FALLBACK_PLAN_KEY = 'free';
export const TRIAL_PLAN_KEY = 'trial';

/** Důvod, proč firma modul nemá. */
export type EntitlementLock = 'not_in_plan' | 'disabled_by_platform' | null;
