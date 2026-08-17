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
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Položky admin navigace (sdíleno server dashboardem i client nav). */
export const NAV_ITEMS: NavItem[] = [
  { href: '/admin', label: 'Přehled', icon: LayoutDashboard },
  { href: '/admin/attention', label: 'Vyžaduje pozornost', icon: Bell },
  { href: '/admin/assets', label: 'Věci', icon: Package },
  { href: '/admin/dispatch', label: 'Výdej', icon: PackageCheck },
  { href: '/admin/locations', label: 'Místa', icon: MapPin },
  { href: '/admin/people', label: 'Lidé', icon: Contact },
  { href: '/admin/categories', label: 'Kategorie', icon: Tags },
  { href: '/admin/inventory', label: 'Inventura', icon: ClipboardCheck },
  { href: '/admin/reservations', label: 'Požadavky', icon: CalendarClock },
  { href: '/admin/objects', label: 'Objekty', icon: Boxes },
  { href: '/admin/carriers', label: 'Nosiče', icon: QrCode },
  { href: '/admin/membership', label: 'Členství', icon: CreditCard },
  { href: '/admin/billing', label: 'Předplatné', icon: Receipt },
  { href: '/admin/access', label: 'Přístup', icon: ShieldCheck },
  { href: '/admin/users', label: 'Uživatelé', icon: Users },
  { href: '/admin/groups', label: 'Skupiny', icon: UsersRound },
  { href: '/admin/found', label: 'Nálezy', icon: MapPinned },
  { href: '/admin/webhooks', label: 'Webhooky', icon: Webhook },
  { href: '/admin/settings', label: 'Nastavení', icon: Settings },
];
