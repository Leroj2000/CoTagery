import {
  buildPermissionMatrix,
  canManageRank,
  delegateRolePermissions,
  membershipRoleKey,
  withImpliedPermissions,
} from '@tagery/shared';

const catalog = [
  'asset.item.view',
  'asset.item.create',
  'asset.item.update',
  'asset.item.delete',
  'asset.item.assign',
  'core.member.view',
  'core.member.invite',
  'core.member.deactivate',
  'core.role.manage',
  'zzz.thing.do',
];

describe('matice oprávnění', () => {
  const sections = buildPermissionMatrix(
    catalog.map((key) => ({ key, sensitivity: key === 'core.role.manage' ? 'high' : 'normal' })),
  );
  const row = (res: string) => sections.flatMap((s) => s.rows).find((r) => r.resource === res)!;

  it('mapuje akce do sloupců Zobrazit/Zakládat/Upravovat/Mazat + speciální', () => {
    const item = row('asset.item');
    expect(item.label).toBe('Položky');
    const col = (c: string) => item.cells.find((x) => x.column === c)?.key;
    expect([col('view'), col('create'), col('update'), col('delete')]).toEqual([
      'asset.item.view',
      'asset.item.create',
      'asset.item.update',
      'asset.item.delete',
    ]);
    expect(item.cells.find((x) => x.column === 'extra')).toMatchObject({
      key: 'asset.item.assign',
      label: 'Přidělovat',
    });
  });

  it('pozvat = zakládat, deaktivovat = mazat; citlivé oprávnění je označené', () => {
    const member = row('core.member');
    expect(member.cells.find((c) => c.key === 'core.member.invite')?.column).toBe('create');
    expect(member.cells.find((c) => c.key === 'core.member.deactivate')?.column).toBe('delete');
    expect(row('core.role').cells[0].sensitive).toBe(true);
  });

  it('neznámý modul nezmizí – spadne do sekce Ostatní', () => {
    expect(sections.at(-1)?.key).toBe('other');
    expect(row('zzz.thing').cells[0].key).toBe('zzz.thing.do');
  });
});

describe('pravidla delegace', () => {
  it('aktér mění jen oprávnění, která sám má', () => {
    const actor = ['asset.item.view', 'asset.item.update'];
    const current = ['asset.item.view', 'core.role.manage']; // core.role.manage aktér nemá
    // Chce: přidat update + delete (delete nemá), odebrat core.role.manage (nesmí).
    const next = delegateRolePermissions(
      ['asset.item.view', 'asset.item.update', 'asset.item.delete'],
      current,
      actor,
    );
    expect(next).toEqual(['asset.item.update', 'asset.item.view', 'core.role.manage']);
  });

  it('doplní závislé „zobrazit" jen pro existující klíče', () => {
    expect(withImpliedPermissions(['asset.item.delete', 'nope.x.y'], catalog)).toEqual([
      'asset.item.delete',
      'asset.item.view',
    ]);
  });

  it('roli lze spravovat jen s nižší úrovní', () => {
    expect(canManageRank(80, 60)).toBe(true);
    expect(canManageRank(60, 60)).toBe(false);
    expect(canManageRank(60, 80)).toBe(false);
  });

  it('klíč do členství: systémové velkými, vlastní beze změny', () => {
    expect(membershipRoleKey('manager')).toBe('MANAGER');
    expect(membershipRoleKey('c_skladnik_ab12cd')).toBe('c_skladnik_ab12cd');
  });
});
