#!/usr/bin/env node
/**
 * Smoke hlavního průchodu Tagery Věci (BACKLOG QA-01, MVP kap. 3):
 * přihlášení → místo → osoba → položka → výpůjčka osobě → kontrola držby a historie
 * → vrácení na místo → kontrola stavu. Bez závislostí (Node 20+ fetch).
 *
 * Proměnné: SMOKE_BASE_URL (např. http://127.0.0.1:3901/api/v1),
 * SMOKE_EMAIL / SMOKE_PASSWORD (výchozí demo účet ze seedu – jen pro izolovaný stack!).
 */
const base = process.env.SMOKE_BASE_URL;
if (!base) {
  console.error('Chybí SMOKE_BASE_URL');
  process.exit(2);
}
if (/tagery\.tech/.test(base) && !process.env.SMOKE_EMAIL) {
  console.error('Proti produkci spouštěj jen s vlastním testovacím účtem (SMOKE_EMAIL/SMOKE_PASSWORD).');
  process.exit(2);
}
const email = process.env.SMOKE_EMAIL ?? 'owner@demo.tagery';
const password = process.env.SMOKE_PASSWORD ?? 'demo1234';
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
let token = '';
let step = 0;

async function api(method, path, body, { expect = [200, 201], auth = true } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(auth && token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!expect.includes(res.status)) {
    throw new Error(`${method} ${path} → HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  return data;
}

function check(label, condition, detail) {
  step += 1;
  if (!condition) {
    throw new Error(`krok ${step} „${label}“ selhal${detail ? `: ${JSON.stringify(detail).slice(0, 300)}` : ''}`);
  }
  console.log(`  ✔ ${step}. ${label}`);
}

async function main() {
  console.log(`Smoke hlavního průchodu proti ${base}`);

  await api('GET', '/assets', undefined, { expect: [401], auth: false });
  check('bez přihlášení API vrací 401', true);

  const tokens = await api('POST', '/auth/login', { email, password });
  token = tokens?.accessToken;
  check('přihlášení vrací access token', typeof token === 'string' && token.length > 20);

  const me = await api('GET', '/auth/me');
  check('profil přihlášeného uživatele', Boolean(me), me);

  const location = await api('POST', '/locations', { name: `Smoke sklad ${stamp}` });
  check('založení místa', Boolean(location?.id), location);

  const person = await api('POST', '/people', { name: `Smoke Pepa ${stamp}` });
  check('založení osoby', Boolean(person?.id), person);

  const asset = await api('POST', '/assets', {
    name: `Smoke vrtačka ${stamp}`,
    homeLocationId: location.id,
  });
  check('založení položky', Boolean(asset?.id), asset);

  const dueAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  await api('POST', `/assets/${asset.id}/movements`, {
    type: 'loan',
    toType: 'person',
    toId: person.id,
    dueAt,
    note: 'smoke výpůjčka',
  });
  const loaned = await api('GET', `/assets/${asset.id}`);
  check(
    'výpůjčka: držitelem je osoba s termínem vrácení',
    loaned?.currentHolderType === 'person' && loaned?.currentHolderId === person.id && Boolean(loaned?.dueAt),
    loaned,
  );

  const mine = await api('GET', `/assets/${asset.id}/movements`);
  const movements = Array.isArray(mine) ? mine : (mine?.items ?? []);
  check('historie obsahuje výpůjčku', movements.some((m) => m.type === 'loan'), mine);

  await api('POST', `/assets/${asset.id}/movements`, {
    type: 'return',
    toType: 'location',
    toId: location.id,
    note: 'smoke vrácení',
  });
  const returned = await api('GET', `/assets/${asset.id}`);
  check(
    'vrácení: položka je dostupná na místě, bez termínu',
    returned?.status === 'available' &&
      returned?.currentHolderType === 'location' &&
      returned?.currentHolderId === location.id &&
      !returned?.dueAt,
    returned,
  );

  const after = await api('GET', `/assets/${asset.id}/movements`);
  const all = Array.isArray(after) ? after : (after?.items ?? []);
  check('historie obsahuje výpůjčku i vrácení', all.some((m) => m.type === 'return') && all.length >= 2, after);

  await api('GET', '/assets/attention');
  check('přehled Pozornost odpovídá', true);

  // SEC-01: webhook do vnitřní sítě musí API odmítnout.
  await api('POST', '/webhooks', { url: 'https://127.0.0.1/hook' }, { expect: [400] });
  await api('POST', '/webhooks', { url: 'http://169.254.169.254/latest' }, { expect: [400] });
  check('webhook na vnitřní adresu je odmítnut (SSRF)', true);

  console.log(`Smoke OK (${step} kroků)`);
}

main().catch((err) => {
  console.error(`✖ Smoke selhal: ${err.message}`);
  process.exit(1);
});
