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
  Rocket,
  Store,
  Search,
  UserRound,
  Printer,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  moduleKey?: string;
  permission?: string;
}
export interface NavSection {
  label?: string;
  items: NavItem[];
}
export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { href: '/admin', label: 'Dnes', icon: LayoutDashboard },
      { href: '/admin/find', label: 'Najít', icon: Search, permission: 'asset.item.view' },
      { href: '/admin/scan', label: 'Skenovat', icon: ScanLine, permission: 'asset.scan.use' },
      { href: '/admin/me', label: 'Moje vybavení', icon: UserRound, permission: 'asset.scan.use' },
      { href: '/admin/assets', label: 'Položky', icon: Package, permission: 'asset.item.view' },
      { href: '/admin/locations', label: 'Místa', icon: MapPin, permission: 'core.location.view' },
      { href: '/admin/people', label: 'Lidé', icon: Contact, permission: 'core.member.view' },
      {
        href: '/admin/attention',
        label: 'Vyžaduje pozornost',
        icon: Bell,
        permission: 'asset.item.view',
      },
    ],
  },
  {
    label: 'Pracovní postupy a moduly',
    items: [
      {
        href: '/admin/workflow',
        label: 'Výdej a přesuny',
        icon: PackageCheck,
        permission: 'asset.movement.perform',
      },
      {
        href: '/admin/inventory',
        label: 'Inventury',
        icon: ClipboardCheck,
        permission: 'asset.inventory.manage',
      },
      {
        href: '/admin/reservations',
        label: 'Požadavky',
        icon: CalendarClock,
        permission: 'asset.reservation.view',
      },
      {
        href: '/admin/rental',
        label: 'Půjčovna',
        icon: Store,
        moduleKey: 'rental',
        permission: 'rental.item.manage',
      },
      {
        href: '/admin/membership',
        label: 'Členství',
        icon: CreditCard,
        moduleKey: 'membership',
        permission: 'membership.card.manage',
      },
      {
        href: '/admin/access',
        label: 'Vstupy',
        icon: ShieldCheck,
        moduleKey: 'access',
        permission: 'access.point.manage',
      },
      { href: '/admin/found', label: 'Nálezy', icon: MapPinned, permission: 'found.report.handle' },
    ],
  },
  {
    label: 'Nastavení a správa',
    items: [
      {
        href: '/admin/onboarding',
        label: 'První kroky',
        icon: Rocket,
        permission: 'asset.item.create',
      },
      {
        href: '/admin/categories',
        label: 'Kategorie',
        icon: Tags,
        permission: 'asset.category.manage',
      },
      {
        href: '/admin/carriers',
        label: 'Identifikátory',
        icon: QrCode,
        permission: 'carrier.item.manage',
      },
      {
        href: '/admin/labels',
        label: 'Editor štítků',
        icon: Printer,
        permission: 'core.organization.configure',
      },
      {
        href: '/admin/objects',
        label: 'Digitální objekty',
        icon: Boxes,
        permission: 'object.item.manage',
      },
      {
        href: '/admin/groups',
        label: 'Skupiny',
        icon: UsersRound,
        permission: 'core.group.manage',
      },
      { href: '/admin/users', label: 'Uživatelé', icon: Users, permission: 'core.member.view' },
      {
        href: '/admin/billing',
        label: 'Předplatné',
        icon: Receipt,
        moduleKey: 'billing',
        permission: 'billing.subscription.manage',
      },
      {
        href: '/admin/webhooks',
        label: 'Integrace',
        icon: Webhook,
        permission: 'core.integration.manage',
      },
      {
        href: '/admin/settings',
        label: 'Nastavení',
        icon: Settings,
        permission: 'core.organization.configure',
      },
    ],
  },
];
export const NAV_ITEMS = NAV_SECTIONS.flatMap((section) => section.items);
