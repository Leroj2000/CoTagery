#!/usr/bin/env node
/**
 * Browser E2E hlavního průchodu webu (BACKLOG QA-02) – Playwright/Chromium proti
 * izolovanému smoke stacku (tools/smoke/run.sh). Navazuje na main-flow.mjs: ten
 * přes API založí místo, osobu a položku a uloží je do SMOKE_OUT.
 *
 * Kroky: přesměrování na /login → špatné heslo → přihlášení → detail položky
 * z API smoke → Pozornost → založení místa formulářem (server action) → odhlášení.
 * Proměnné: E2E_BASE_URL (např. http://web:3000), SMOKE_OUT, E2E_EMAIL/E2E_PASSWORD
 * (výchozí demo účet ze seedu – jen pro izolovaný stack!).
 */
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.E2E_BASE_URL ?? 'http://web:3000';
const email = process.env.E2E_EMAIL ?? 'owner@demo.tagery';
const password = process.env.E2E_PASSWORD ?? 'demo1234';
const smoke = process.env.SMOKE_OUT ? JSON.parse(readFileSync(process.env.SMOKE_OUT, 'utf8')) : {};
const T = 20_000;

let step = 0;
const ok = (label) => console.log(`  ✔ ${++step}. ${label}`);

async function main() {
  console.log(`Browser E2E proti ${base}`);
  const browser = await chromium.launch();
  const context = await browser.newContext({ locale: 'cs-CZ' });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  try {
    await page.goto(`${base}/admin`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/login/, { timeout: T });
    ok('nepřihlášený /admin → /login');

    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', 'spatne-heslo');
    await page.click('button[type="submit"]');
    await page.getByText('Neplatný e-mail nebo heslo.').waitFor({ timeout: T });
    ok('špatné heslo ukáže chybu');

    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL((u) => u.pathname.startsWith('/admin'), { timeout: T });
    ok('přihlášení → /admin');

    if (smoke.assetId) {
      await page.goto(`${base}/admin/assets/${smoke.assetId}`);
      await page.getByText(smoke.assetName, { exact: false }).first().waitFor({ timeout: T });
      ok('detail položky z API smoke');
    }

    await page.goto(`${base}/admin/attention`);
    await page.getByText('Vyžaduje pozornost').first().waitFor({ timeout: T });
    ok('stránka Pozornost');

    const name = `E2E sklad ${Date.now().toString(36)}`;
    await page.goto(`${base}/admin/locations`);
    await page.fill('input[name="name"]', name);
    await page.getByRole('button', { name: 'Vytvořit místo' }).click();
    // Server action po úspěchu revaliduje stránku – místo musí být v hierarchii.
    let listed = false;
    for (let i = 0; i < 10 && !listed; i++) {
      await page.waitForTimeout(1000);
      if (i > 2) await page.goto(`${base}/admin/locations`);
      const main = await page.locator('main').first().innerText();
      listed = (main.split('Hierarchie')[1] ?? '').includes(name);
    }
    if (!listed) throw new Error(`místo ${name} se po odeslání formuláře neobjevilo v hierarchii`);
    ok('založení místa formulářem (server action) a zobrazení v seznamu');

    await context.clearCookies();
    await page.goto(`${base}/admin`);
    await page.waitForURL(/\/login/, { timeout: T });
    ok('po smazání session zpět na /login');

    if (consoleErrors.length) throw new Error(`JS chyby na stránce: ${consoleErrors.slice(0, 3).join(' | ')}`);
    console.log(`Browser E2E OK (${step} kroků)`);
  } catch (err) {
    await page.screenshot({ path: '/tmp/e2e-fail.png', fullPage: true }).catch(() => {});
    const body = await page.locator('main').first().innerText().catch(() => '');
    console.error(`  stránka: ${body.replace(/\s+/g, ' ').slice(0, 600)}`);
    console.error(`  inputs[name=name]: ${await page.locator('input[name="name"]').count()}`);
    console.error(`✖ E2E selhal po kroku ${step} na ${page.url()}: ${err.message.split('\n')[0]}`);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

await main();
