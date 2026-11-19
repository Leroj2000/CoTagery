import {
  assertSafeWebhookUrl,
  isPrivateAddress,
  parseAllowedHosts,
  UnsafeUrlError,
} from './url-guard';

const publicLookup = async (): Promise<string[]> => ['93.184.216.34'];
const privateLookup = async (): Promise<string[]> => ['93.184.216.34', '10.0.0.5'];

describe('url-guard (SSRF)', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.19.0.1',
    '192.168.1.10',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '::1',
    '::',
    'fd00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
  ])('blokuje vnitřní adresu %s', (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each(['93.184.216.34', '8.8.8.8', '2606:4700:4700::1111', '172.32.0.1'])(
    'povolí veřejnou adresu %s',
    (ip) => {
      expect(isPrivateAddress(ip)).toBe(false);
    },
  );

  it('povolí veřejnou https URL', async () => {
    const url = await assertSafeWebhookUrl('https://hooks.example.com/x', {
      production: true,
      lookup: publicLookup,
    });
    expect(url.hostname).toBe('hooks.example.com');
  });

  it('v produkci odmítne http', async () => {
    await expect(
      assertSafeWebhookUrl('http://hooks.example.com/x', { production: true, lookup: publicLookup }),
    ).rejects.toThrow(UnsafeUrlError);
  });

  it('mimo produkci http povolí', async () => {
    await expect(
      assertSafeWebhookUrl('http://hooks.example.com/x', { production: false, lookup: publicLookup }),
    ).resolves.toBeInstanceOf(URL);
  });

  it.each([
    'http://172.19.0.1:9099/hook',
    'https://127.0.0.1/',
    'https://[::1]/',
    'https://localhost/',
    'https://metadata.google.internal/',
    'https://169.254.169.254/latest/meta-data',
  ])('odmítne vnitřní cíl %s', async (raw) => {
    await expect(
      assertSafeWebhookUrl(raw, { production: false, lookup: publicLookup }),
    ).rejects.toThrow(UnsafeUrlError);
  });

  it('odmítne host, který se přeloží i na privátní adresu', async () => {
    await expect(
      assertSafeWebhookUrl('https://evil.example.com/', { production: true, lookup: privateLookup }),
    ).rejects.toThrow('vnitřní sítě');
  });

  it('odmítne jiný protokol a přihlašovací údaje', async () => {
    await expect(assertSafeWebhookUrl('ftp://x.cz/', { production: false })).rejects.toThrow(
      UnsafeUrlError,
    );
    await expect(
      assertSafeWebhookUrl('https://u:p@hooks.example.com/', { production: false, lookup: publicLookup }),
    ).rejects.toThrow('přihlašovací');
    await expect(assertSafeWebhookUrl('nonsense', { production: false })).rejects.toThrow(
      'Neplatná URL',
    );
  });

  it('povolí výslovně povolený interní host (WEBHOOK_ALLOWED_HOSTS)', async () => {
    const allowedHosts = parseAllowedHosts(' n8n_tagery , other ');
    expect(allowedHosts).toEqual(['n8n_tagery', 'other']);
    await expect(
      assertSafeWebhookUrl('http://n8n_tagery:5678/webhook/x', {
        production: true,
        allowedHosts,
        lookup: privateLookup,
      }),
    ).resolves.toBeInstanceOf(URL);
  });
});
