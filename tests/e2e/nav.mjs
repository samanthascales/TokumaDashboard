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
await page.goto(B + 'app'); await page.waitForTimeout(1200);
await step('the menu is one flat list of plain names', async () => {
  const names = (await aside().locator('nav > ul > li > a').allInnerTexts()).map((x) => x.trim());
  const want = ['Dashboard', 'Revenue & expenses', 'Products', 'Circularity', 'Reports', 'Funding', 'Learn', 'Settings'];
  if (want.join('|') !== names.join('|')) throw new Error('menu is ' + names.join(', '));
  if (await aside().locator('nav button[aria-expanded]').count()) throw new Error('menu still has expandable groups');
  await page.screenshot({ path: SP + '/shots3/nav-flat.png', clip: { x: 0, y: 0, width: 260, height: 600 } });
});
await step('sub-pages light up their parent: Inventory under Products', async () => {
  await page.goto(B + 'app/products/inventory'); await page.waitForTimeout(600);
  const current = await aside().locator('nav a[aria-current="page"]').allInnerTexts();
  if (current.map((x) => x.trim()).join() !== 'Products') throw new Error('active: ' + current);
});
await step('Funding has its own menu item', async () => {
  await aside().getByRole('link', { name: 'Funding' }).click();
  await page.waitForURL(/learn\/funding/);
  const current = await aside().locator('nav a[aria-current="page"]').allInnerTexts();
  if (current.map((x) => x.trim()).join() !== 'Funding') throw new Error('active: ' + current);
});
await step('Reports links to Share a report', async () => {
  await page.goto(B + 'app/reports'); await page.waitForTimeout(600);
  await page.getByRole('link', { name: 'Share a report' }).click();
  await page.waitForURL(/#\/app\/share$/);
});
await step('old addresses forward to the new pages', async () => {
  for (const [from, to] of [['app/transactions', '/app/money'], ['app/supply-chain', '/app/products/suppliers'], ['app/education', '/app/learn'], ['app/funding', '/app/learn/funding']]) {
    await page.goto(B + from); await page.waitForTimeout(400);
    if (!page.url().endsWith('#' + to)) throw new Error(from + ' went to ' + page.url());
  }
});
console.log(errors.length ? 'ERRORS: ' + errors.join('; ') : 'NO RUNTIME ERRORS');
await browser.close();
