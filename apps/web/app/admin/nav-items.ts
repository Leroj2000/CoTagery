import {
  LayoutDashboard,
  Bell,
  Package,
  MapPin,
  Contact,
  Tags,
  PackageCheck,
  ClipboardCheck,
  CalendarClock,
  Boxes,
  QrCode,
  CreditCard,
  Receipt,
  ShieldCheck,
  Users,
  UsersRound,
  Settings,
  MapPinned,
  Webhook,
  ScanLine,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavSection {
  /** Nadpis sekce; když chybí, je to hlavní (neoznačená) sekce. */
  label?: string;
  items: NavItem[];
}

/**
 * Admin navigace rozdělená do sekcí (sdíleno server dashboardem i client nav).
 * Hlavní sekce je bez nadpisu; administrativní věci jsou pod „Správa".
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    items: [{ href: '/admin', label: 'Přehled', icon: LayoutDashboard }],
  },
  {
    items: [
      { href: '/admin/scan', label: 'Sken', icon: ScanLine },
      { href: '/admin/workflow', label: 'Výdej', icon: PackageCheck },
      { href: '/admin/attention', label: 'Vyžaduje pozornost', icon: Bell },
      { href: '/admin/assets', label: 'Věci', icon: Package },
      { href: '/admin/categories', label: 'Kategorie', icon: Tags },
      { href: '/admin/inventory', label: 'Inventura', icon: ClipboardCheck },
      { href: '/admin/reservations', label: 'Požadavky', icon: CalendarClock },
      { href: '/admin/objects', label: 'Objekty', icon: Boxes },
      { href: '/admin/carriers', label: 'Identifikátory', icon: QrCode },
      { href: '/admin/membership', label: 'Členství', icon: CreditCard },
      { href: '/admin/billing', label: 'Předplatné', icon: Receipt },
      { href: '/admin/access', label: 'Přístup', icon: ShieldCheck },
      { href: '/admin/groups', label: 'Skupiny', icon: UsersRound },
      { href: '/admin/found', label: 'Nálezy', icon: MapPinned },
      { href: '/admin/webhooks', label: 'Webhooky', icon: Webhook },
    ],
  },
  {
    label: 'Správa',
    items: [
      { href: '/admin/users', label: 'Uživatelé', icon: Users },
      { href: '/admin/people', label: 'Lidé', icon: Contact },
      { href: '/admin/locations', label: 'Místa', icon: MapPin },
      { href: '/admin/settings', label: 'Nastavení', icon: Settings },
    ],
  },
];

/** Ploché položky (pro dashboard rozcestník a jednoduché filtry). */
export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);
