import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalStorageAdapter } from './local-storage.adapter';

describe('LocalStorageAdapter – klíče (SEC-02)', () => {
  let dir: string;
  let storage: LocalStorageAdapter;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tagery-storage-'));
    storage = new LocalStorageAdapter(dir);
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('uloží a přečte soubor pod běžným klíčem', async () => {
    await storage.put('asset-media/t1/a1/file', Buffer.from('ok'));
    expect((await storage.get('asset-media/t1/a1/file')).toString()).toBe('ok');
    expect(await storage.size('asset-media/t1/a1/file')).toBe(2);
  });

  it.each(['../escape', 'a/../../escape', '/etc/passwd', 'a\\..\\..\\x', '', 'a\u0000b'])(
    'odmítne nebezpečný klíč %j',
    async (key) => {
      await expect(storage.put(key, Buffer.from('x'))).rejects.toThrow(/klíč/i);
      await expect(storage.get(key)).rejects.toThrow(/klíč/i);
    },
  );

  it('size() pro nebezpečný klíč vrátí null a del() vyhodí', async () => {
    expect(await storage.size('../x')).toBeNull();
    await expect(storage.del('../x')).rejects.toThrow(/klíč/i);
  });
});
