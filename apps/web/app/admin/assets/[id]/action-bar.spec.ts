import { assetAbilities } from '../../../lib/abilities';
import { detailActions } from './action-bar';

const VIEWER = new Set(['asset.item.view', 'core.member.view']);
const MANAGER = new Set([
  'asset.item.view',
  'asset.item.update',
  'asset.movement.perform',
  'carrier.item.manage',
  'asset.issue.manage',
  'asset.media.manage',
  'asset.purchase.update',
]);

describe('řádek akcí na detailu položky', () => {
  it('Náhled nevidí žádnou akci', () => {
    expect(detailActions(assetAbilities(VIEWER), { canReturn: true, otherActionCount: 3 })).toEqual(
      [],
    );
  });

  it('manažer u vypůjčené položky: Vrátit první, pak ostatní', () => {
    const keys = detailActions(assetAbilities(MANAGER), {
      canReturn: true,
      otherActionCount: 2,
    }).map((a) => a.key);
    expect(keys).toEqual(['return', 'move', 'issue', 'service', 'carrier', 'edit']);
  });

  it('položka doma: hlavní akce je výdej; kotvy míří na existující formuláře', () => {
    const actions = detailActions(assetAbilities(MANAGER), {
      canReturn: false,
      otherActionCount: 2,
    });
    expect(actions[0]).toMatchObject({ key: 'move', primary: true, href: '#asset-actions' });
    expect(actions.map((a) => a.href)).toEqual([
      '#asset-actions',
      '#problemy',
      '#servis',
      '#identifikator',
      '#edit-asset',
    ]);
  });

  it('jen právo hlásit problémy → jen Nahlásit problém', () => {
    expect(
      detailActions(assetAbilities(new Set(['asset.issue.manage'])), {
        canReturn: true,
        otherActionCount: 1,
      }).map((a) => a.key),
    ).toEqual(['issue']);
  });
});
