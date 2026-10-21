import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
// Screenshots go to tests/e2e/output (or TEST_OUT). The app must be running at BASE_URL (see tests/README.md).
const SP = process.env.TEST_OUT ?? new URL('./output', import.meta.url).pathname;
const FIX = new URL('./fixtures', import.meta.url).pathname;
const ROOT = new URL('../../', import.meta.url).pathname;
for (const d of ['', '/shots3', '/shots4']) mkdirSync(SP + d, { recursive: true });
const B = process.env.BASE_URL ?? 'http://localhost:4173/#/';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const step = async (name, fn) => { try { await fn(); console.log('OK  ', name); } catch (e) { console.log('FAIL', name, '—', e.message.split('\n')[0]); } };
const aside = () => page.locator('aside');
const expanded = async (group) => (await aside().getByRole('button', { name: new RegExp('(Expand|Collapse) ' + group) }).getAttribute('aria-expanded')) === 'true';
const visible = async (name) => { const box = await aside().getByRole('link', { name, exact: false }).boundingBox(); const nav = await aside().locator('nav').boundingBox(); return !!box && box.height > 4 && (await aside().getByRole('link', { name, exact: false }).evaluate((el) => { const r = el.getBoundingClientRect(); const ul = el.closest('ul'); const c = ul.getBoundingClientRect(); return c.height > 4 && r.top >= c.top - 1 && r.bottom <= c.bottom + 1; })); };
await page.goto(B + 'app'); await page.waitForTimeout(1200);
await step('the menu has the six main pages', async () => {
  const names = (await aside().locator('nav > ul > li > a').allInnerTexts()).map((x) => x.replace(/\s*NEW\s*$/, '').trim());
  const want = ['Dashboard', 'Revenue & expenses', 'Products', 'Circularity', 'Reports', 'Learn', 'Settings'];
  if (want.join('|') !== names.join('|')) throw new Error('menu is ' + names.join(', '));
});
await step('groups start collapsed on the dashboard', async () => {
  if (await expanded('Products') || await expanded('Learn')) throw new Error('a group is expanded');
  if (await visible('Inventory')) throw new Error('Inventory visible');
  if (await visible('Funding')) throw new Error('Funding visible');
  await page.screenshot({ path: SP + '/shots3/nav-collapsed.png', clip: { x: 0, y: 0, width: 260, height: 600 } });
});
await step('arrow opens Products and shows Inventory and Suppliers', async () => {
  await aside().getByRole('button', { name: 'Expand Products' }).click();
  await page.waitForTimeout(300);
  if (!(await visible('Inventory')) || !(await visible('Suppliers'))) throw new Error('not shown');
  await aside().getByRole('link', { name: /Inventory/ }).click();
  await page.waitForURL(/inventory/);
});
await step('opening a page inside a group opens that group', async () => {
  await page.goto(B + 'app/learn/funding'); await page.waitForTimeout(600);
  if (!(await visible('Funding'))) throw new Error('not open');
  await page.screenshot({ path: SP + '/shots3/nav-open.png', clip: { x: 0, y: 0, width: 260, height: 600 } });
});
await step('collapsed links are skipped by keyboard', async () => {
  await aside().getByRole('button', { name: 'Collapse Learn' }).click();
  await page.waitForTimeout(300);
  const inert = await aside().locator('ul[inert]').count();
  if (inert < 1) throw new Error('no inert group');
});
await step('the open/closed choice is remembered after reload', async () => {
  await page.goto(B + 'app'); await page.reload(); await page.waitForTimeout(1000);
  if (!(await visible('Inventory'))) throw new Error('Products should stay open');
  if (await visible('Funding')) throw new Error('Learn should stay closed');
});
await step('old addresses forward to the new pages', async () => {
  for (const [from, to] of [['app/transactions', '/app/money'], ['app/supply-chain', '/app/products/suppliers'], ['app/education', '/app/learn'], ['app/funding', '/app/learn/funding']]) {
    await page.goto(B + from); await page.waitForTimeout(400);
    if (!page.url().endsWith('#' + to)) throw new Error(from + ' went to ' + page.url());
  }
});
console.log(errors.length ? 'ERRORS: ' + errors.join('; ') : 'NO RUNTIME ERRORS');
await browser.close();
