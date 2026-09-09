import fs from 'node:fs';
import crypto from 'node:crypto';
import readline from 'node:readline';
import { Writable } from 'node:stream';
import { save, read } from './bridge.mjs';

const directory = '/var/lib/tagery-telegram';
fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
if (process.argv.includes('--pair')) {
  if (read(`${directory}/owner.json`)) throw new Error('Bot je již spárovaný. Vlastníka tento příkaz nemění.');
  const code = crypto.randomBytes(16).toString('hex');
  save(`${directory}/pairing.json`, { code, expiresAt: Date.now() + 15 * 60000, attempts: 0 });
  console.log(`V soukromém chatu novému botovi pošli do 15 minut:\n/pair ${code}`);
} else {
  if (!process.stdin.isTTY) throw new Error('Token zadávej pouze v interaktivním terminálu.');
  if (fs.existsSync(`${directory}/token`)) throw new Error('Token již existuje; nebude přepsán.');
  const silent = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
  const input = readline.createInterface({ input: process.stdin, output: silent, terminal: true });
  process.stdout.write('Vlož token NOVÉHO bota (nebude vidět), poté Enter: ');
  input.question('', value => {
    input.close(); process.stdout.write('\n');
    const token = value.trim();
    if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(token)) { console.error('Neplatný formát; nic neuloženo.'); process.exitCode = 1; return; }
    fs.writeFileSync(`${directory}/token`, `${token}\n`, { mode: 0o600, flag: 'wx' });
    console.log('Token bezpečně uložen. Obsah se nevypisuje ani nepředává do Codexu jako proměnná.');
  });
}
