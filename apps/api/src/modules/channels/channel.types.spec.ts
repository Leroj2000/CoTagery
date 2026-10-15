import { maskExternalRef, returningRows } from './channel.types';

describe('channel.types', () => {
  it('returningRows sjednotí výsledek UPDATE/DELETE … RETURNING', () => {
    expect(returningRows([[{ id: 1 }], 1])).toEqual([{ id: 1 }]);
    expect(returningRows([[], 0])).toEqual([]);
    expect(returningRows([{ id: 1 }])).toEqual([{ id: 1 }]);
    expect(returningRows(undefined)).toEqual([]);
  });

  it('maskExternalRef', () => {
    expect(maskExternalRef('123456789')).toBe('12…89');
  });
});
