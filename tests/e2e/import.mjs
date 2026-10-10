import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
// Screenshots go to tests/e2e/output (or TEST_OUT). The app must be running at BASE_URL (see tests/README.md).
const SP = process.env.TEST_OUT ?? new URL('./output', import.meta.url).pathname;
const FIX = new URL('./fixtures', import.meta.url).pathname;
const ROOT = new URL('../../', import.meta.url).pathname;
for (const d of ['', '/shots3', '/shots4']) mkdirSync(SP + d, { recursive: true });
const B = process.env.BASE_URL ?? 'http://localhost:4173/#/';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1100 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('CERT')) errors.push(m.text()); });
const step = async (name, fn) => { try { await fn(); console.log('OK  ', name); } catch (e) { console.log('FAIL', name, '—', e.message.split('\n')[0]); } };
const dlg = () => page.getByRole('dialog');
const count = async (label) => +(await dlg().locator('div.rounded-lg', { hasText: label }).first().locator('p.num').innerText()).replace(/,/g, '');

await page.goto(B);
await page.evaluate(() => localStorage.setItem('tokuma-state-v2', JSON.stringify({
  products: [{ id: 'p1', name: 'Sailcloth Tote', sku: 'TKM-TOTE', category: 'Accessories', price: 45, unitCost: 12, materials: [{ name: 'Reclaimed sailcloth', weightKg: 0.4, recycled: false, reused: true }], circularityScore: 100, stockOnHand: 40, lowStockThreshold: 0, safetyStock: 0 }],
  customers: [{ id: 'c1', name: 'Jane Smith', email: 'jane@smith.co', city: '', joinedDate: '2026-01-01' }],
})));

await step('CSV: columns guessed, rows classified correctly', async () => {
  await page.goto(B + 'app/transactions'); await page.reload(); await page.waitForTimeout(1000);
  await page.getByRole('button', { name: /Import CSV/ }).click();
  await page.setInputFiles('#import-file', FIX + '/bank.csv');
  await dlg().getByText('match your columns').waitFor();
  const picked = {};
  for (const k of ['date', 'amount', 'product', 'quantity', 'customer', 'note']) picked[k] = await page.locator('#map-' + k + ' option:checked').innerText();
  console.log('     guessed:', JSON.stringify(picked));
  if (picked.date !== 'Date' || picked.amount !== 'Amount' || picked.product !== 'Item' || picked.quantity !== 'Qty' || picked.customer !== 'Client') throw new Error('bad guess');
  await page.screenshot({ path: SP + '/shots3/import-map.png' });
  await page.getByRole('button', { name: /Review 6 rows/ }).click();
  await page.waitForTimeout(300);
  const c = { ok: await count('Ready'), warn: await count('Ready, with notes'), dup: await count('Already imported'), err: await count('Can’t import') };
  console.log('     counts:', JSON.stringify(c));
  if (c.ok !== 3 || c.warn !== 1 || c.err !== 2) throw new Error('unexpected counts');
  const txt = await dlg().innerText();
  for (const s of ['Amount “banana” isn’t a number', 'Date “02/30/2026” isn’t a date', 'No product called “Mystery Scarf”', '−$1,200.00']) if (!txt.includes(s)) throw new Error('missing: ' + s);
  await page.screenshot({ path: SP + '/shots3/import-review.png' });
  await page.getByRole('button', { name: 'Import 4 transactions' }).click();
  await page.getByText('Imported 4 transactions').waitFor();
});
await step('re-importing the same CSV flags duplicates', async () => {
  await page.getByRole('button', { name: /Import CSV/ }).click();
  await page.setInputFiles('#import-file', FIX + '/bank.csv');
  await page.getByRole('button', { name: /Review 6 rows/ }).click();
  await page.waitForTimeout(300);
  const d = await count('Already imported');
  if (d !== 4) throw new Error('duplicates=' + d);
  if (!(await page.getByRole('button', { name: 'Import 0 transactions' }).isDisabled())) throw new Error('should be disabled');
  await page.keyboard.press('Escape');
});
await step('Excel: picks the data sheet, reads date cells, matches SKU, adds new customer', async () => {
  await page.getByRole('button', { name: /Import CSV/ }).click();
  await page.setInputFiles('#import-file', FIX + '/sales.xlsx');
  await dlg().getByText('match your columns').waitFor();
  const sheet = await page.locator('#import-sheet option:checked').innerText();
  if (!sheet.startsWith('Sales Sept')) throw new Error('sheet ' + sheet);
  await page.getByRole('button', { name: /Review 3 rows/ }).click();
  await page.waitForTimeout(300);
  const txt = await dlg().innerText();
  for (const s of ['Sep 10, 2026', 'New customer “New Buyer” will be added', 'Materials']) if (!txt.includes(s)) throw new Error('missing: ' + s);
  await page.getByRole('button', { name: 'Import 3 transactions' }).click();
  await page.getByText('Imported 3 transactions').waitFor();
});
await step('imported data flows into the app', async () => {
  await page.waitForTimeout(500);
  const n = await page.locator('main').innerText();
  if (!/7 transactions/.test(n)) throw new Error('expected 7 transactions');
  await page.goto(B + 'app/customers'); await page.waitForTimeout(1000);
  if (!(await page.locator('main').innerText()).includes('New Buyer')) throw new Error('New Buyer missing');
  const rate = (await page.locator('aside').innerText()).match(/Circularity rate\s+(\S+)/)?.[1];
  console.log('     sidebar circularity:', rate);
  if (rate !== '100.0%') throw new Error('rate ' + rate);
});
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO RUNTIME ERRORS');
await browser.close();
