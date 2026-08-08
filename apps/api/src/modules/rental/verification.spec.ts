import { meetsLevel, rollingAverage } from './verification';

describe('rental verification helpers', () => {
  it('meetsLevel: vyšší nebo rovná úroveň projde', () => {
    expect(meetsLevel('document', 'contact')).toBe(true);
    expect(meetsLevel('contact', 'contact')).toBe(true);
    expect(meetsLevel('none', 'contact')).toBe(false);
    expect(meetsLevel('full_kyc', 'document')).toBe(true);
  });

  it('rollingAverage: první hodnocení = samo, pak průměr', () => {
    expect(rollingAverage(0, 0, 5)).toBe(5);
    expect(rollingAverage(5, 1, 3)).toBe(4);
    expect(rollingAverage(4, 2, 1)).toBe(3);
  });
});
