import { assetAbilities, canInviteMembers, hiddenNavHrefs } from './abilities';

// Efektivní permissions rolí v APRIS (výřez z tenant_role_permission_keys).
const VIEWER = new Set([
  'asset.handoff.use',
  'asset.item.view',
  'asset.reservation.view',
  'asset.selfloan.use',
  'attendance.entry.use',
  'core.calendar.view',
  'core.location.view',
  'core.member.view',
  'core.person.view',
]);
const MANAGER = new Set([
  ...VIEWER,
  'asset.item.update',
  'asset.movement.perform',
  'carrier.item.manage',
  'asset.issue.manage',
  'asset.media.manage',
  'asset.purchase.update',
]);
const OWNER = new Set([...MANAGER, 'core.member.invite', 'core.integration.manage']);

describe('assetAbilities', () => {
  it('Náhled nevidí žádný zápisový formulář na detailu položky', () => {
    expect(assetAbilities(VIEWER)).toEqual({
      canEdit: false,
      canMove: false,
      canCarrier: false,
      canIssue: false,
      canManagePhotos: false,
      canEditPurchase: false,
    });
  });

  it('manažer vidí všechny formuláře', () => {
    expect(Object.values(assetAbilities(MANAGER)).every(Boolean)).toBe(true);
  });

  it('každá schopnost závisí jen na své permission', () => {
    expect(assetAbilities(new Set(['asset.issue.manage']))).toMatchObject({
      canIssue: true,
      canEdit: false,
      canMove: false,
      canCarrier: false,
    });
    expect(assetAbilities(new Set(['carrier.item.manage'])).canCarrier).toBe(true);
    expect(assetAbilities(new Set(['asset.movement.perform'])).canMove).toBe(true);
  });
});

describe('canInviteMembers', () => {
  it('Náhled a manažer nezvou, vlastník ano', () => {
    expect(canInviteMembers(VIEWER)).toBe(false);
    expect(canInviteMembers(MANAGER)).toBe(false);
    expect(canInviteMembers(OWNER)).toBe(true);
  });
});

describe('hiddenNavHrefs', () => {
  const items = [
    { href: '/admin/users', permission: 'core.member.view' },
    { href: '/admin/roles', permission: 'core.role.view' },
    { href: '/admin/webhooks' },
    { href: '/admin/settings/notifications' },
    { href: '/admin/calendar', permission: 'core.calendar.view', moduleKey: 'calendar' },
  ];

  it('Náhled bez správy notifikací: skryté role i notifikace, Integrace zůstávají', () => {
    expect(
      hiddenNavHrefs(items, {
        perms: VIEWER,
        inactiveModules: new Set(),
        canManageNotifications: false,
      }),
    ).toEqual(['/admin/roles', '/admin/settings/notifications']);
  });

  it('správce notifikací je vidí; vypnutý modul skryje položku i s permission', () => {
    expect(
      hiddenNavHrefs(items, {
        perms: OWNER,
        inactiveModules: new Set(['calendar']),
        canManageNotifications: true,
      }),
    ).toEqual(['/admin/roles', '/admin/calendar']);
  });
});
