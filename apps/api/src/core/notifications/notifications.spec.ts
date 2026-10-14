import {
  NOTIFICATION_BY_KEY,
  exampleVariables,
  renderEmail,
  templateVariables,
  validateTemplate,
} from '@tagery/shared';

const invitation = NOTIFICATION_BY_KEY.get('invitation')!;

describe('notifikace – šablony', () => {
  it('dosadí proměnné, odstavce a tlačítko z odkazu', () => {
    const r = renderEmail(
      'Pozvánka do {{firma}}',
      'Ahoj {{jmeno}},\n\nvítej.\n\n[Přijmout]({{odkaz}})',
      { firma: 'ACME', jmeno: 'Jana', odkaz: 'https://app.tagery.tech/x?t=1' },
    );
    expect(r.subject).toBe('Pozvánka do ACME');
    expect(r.text).toContain('Ahoj Jana,');
    expect(r.text).toContain('Přijmout: https://app.tagery.tech/x?t=1');
    expect(r.html).toContain('<a href="https://app.tagery.tech/x?t=1"');
    expect(r.html).toContain('background:#4f46e5'); // samostatný odkaz = tlačítko
  });

  it('hodnoty proměnných se escapují a nemění strukturu', () => {
    const r = renderEmail('{{jmeno}}', 'Ahoj {{jmeno}}', {
      jmeno: '<script>alert(1)</script>\n\n[x](javascript:alert(1))',
    });
    expect(r.html).not.toContain('<script>');
    expect(r.html).toContain('&lt;script&gt;');
    expect(r.html).not.toContain('href="javascript');
  });

  it('nebezpečné URL v odkazu se nevykreslí jako odkaz', () => {
    const r = renderEmail('S', '[Klikni](javascript:alert(1))', {});
    expect(r.html).not.toContain('href=');
    expect(r.text).toContain('Klikni');
  });

  it('víceřádková hodnota (souhrn) → řádky', () => {
    const r = renderEmail('S', '{{souhrn}}', { souhrn: '• A: 1\n• B: 2' });
    expect(r.html).toContain('• A: 1<br>• B: 2');
  });

  it('validace: povinné a neznámé proměnné, prázdné texty', () => {
    expect(validateTemplate(invitation, 'S', 'Ahoj {{jmeno}} {{odkaz}}')).toEqual([]);
    expect(validateTemplate(invitation, 'S', 'Ahoj {{jmeno}}').join()).toMatch(/odkaz/);
    expect(validateTemplate(invitation, 'S {{heslo}}', '{{odkaz}}').join()).toMatch(/Neznámé/);
    expect(validateTemplate(invitation, ' ', '{{odkaz}}').join()).toMatch(/Předmět/);
    expect(templateVariables('{{ a_b }} {{c}} {{a_b}}')).toEqual(['a_b', 'c']);
  });

  it('výchozí texty všech notifikací jsou platné', () => {
    for (const def of NOTIFICATION_BY_KEY.values()) {
      expect(validateTemplate(def, def.defaultSubject, def.defaultBody)).toEqual([]);
      const r = renderEmail(def.defaultSubject, def.defaultBody, exampleVariables(def));
      expect(r.subject).not.toContain('{{');
      expect(r.text).not.toContain('{{');
    }
  });
});
