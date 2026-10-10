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
const picked = async () => { const o = {}; for (const k of ['date', 'amount', 'unitPrice', 'category', 'product', 'quantity', 'customer']) o[k] = await page.locator('#map-' + k + ' option:checked').innerText(); return o; };
const amounts = async () => (await dlg().locator('tbody tr td:last-child').allInnerTexts()).filter((t) => /\$/.test(t));

await page.goto(B);
await page.evaluate(() => localStorage.setItem('tokuma-state-v2', JSON.stringify({
  profile: { businessName: 'Loopy Goods' },
  products: [
    { id: 'p1', name: 'Sailcloth Tote', sku: 'TKM-TOTE', category: 'Bags', price: 45, unitCost: 12, materials: [{ name: 'Reclaimed sailcloth', weightKg: 0.4, recycled: false, reused: true }], circularityScore: 100, stockOnHand: 40, lowStockThreshold: 0, safetyStock: 0 },
    { id: 'p2', name: 'Canvas Pouch', sku: 'TKM-POUCH', category: 'Bags', price: 45, unitCost: 10, materials: [{ name: 'Organic canvas', weightKg: 0.2, recycled: false, reused: false }], circularityScore: 0, stockOnHand: 30, lowStockThreshold: 0, safetyStock: 0 },
  ],
  customers: [{ id: 'c1', name: 'Jane Smith', email: 'jane@smith.co', city: '', joinedDate: '2026-01-01' }],
})));
await page.goto(B + 'app'); await page.reload(); await page.waitForTimeout(1500);

await step('dashboard shows Import sales in header, first-sale step and empty chart', async () => {
  const n = await page.getByRole('button', { name: /Import sales/ }).count();
  if (n !== 3) throw new Error('found ' + n + ' Import sales buttons');
  await page.screenshot({ path: SP + '/shots3/dash-import-buttons.png' });
});
await step('Shopify export: uses line price × qty, not the order Total', async () => {
  await page.getByRole('button', { name: /Import sales/ }).first().click();
  await dlg().getByText('Import sales').first().waitFor();
  await page.setInputFiles('#import-file', FIX + '/shopify_orders.csv');
  await dlg().getByText('match your columns').waitFor();
  const p = await picked(); console.log('     mapping:', JSON.stringify(p));
  if (p.amount !== '— Not in my file —' || p.unitPrice !== 'Lineitem price' || p.quantity !== 'Lineitem quantity' || p.product !== 'Lineitem name' || p.customer !== 'Billing Name' || p.date !== 'Created at') throw new Error('bad mapping');
  await page.getByRole('button', { name: /Review 3 rows/ }).click();
  const a = await amounts(); console.log('     amounts:', a.join(' '));
  if (a.join(',') !== '+$90.00,+$45.00,+$45.00') throw new Error('amounts');
  await page.screenshot({ path: SP + '/shots3/shopify-review.png' });
  await page.getByRole('button', { name: 'Import 3 sales' }).click();
  await page.getByText('Imported 3 sales').first().waitFor();
});
await step('Square export: net sales, category left as Product sale, identical rows both kept', async () => {
  await page.getByRole('button', { name: /Import sales/ }).first().click();
  await page.setInputFiles('#import-file', FIX + '/square_items.csv');
  await dlg().getByText('match your columns').waitFor();
  const p = await picked(); console.log('     mapping:', JSON.stringify(p));
  if (p.amount !== 'Net Sales' || p.category !== '— Not in my file —' || p.product !== 'Item' || p.quantity !== 'Qty') throw new Error('bad mapping');
  await page.getByRole('button', { name: /Review 3 rows/ }).click();
  const txt = await dlg().innerText();
  if ((txt.match(/Product sale/g) || []).length !== 3) throw new Error('categories');
  const a = await amounts(); console.log('     amounts:', a.join(' '));
  if (a.join(',') !== '+$40.00,+$45.00,+$45.00') throw new Error('amounts');
  await page.getByRole('button', { name: 'Import 3 sales' }).click();
  await page.getByText('Imported 3 sales').first().waitFor();
});
await step('Etsy export: 2-digit year dates, new buyer added, negative total recorded as refund', async () => {
  await page.getByRole('button', { name: /Import sales/ }).first().click();
  await page.setInputFiles('#import-file', FIX + '/etsy_sold_items.csv');
  await dlg().getByText('match your columns').waitFor();
  const p = await picked(); console.log('     mapping:', JSON.stringify(p));
  if (p.date !== 'Sale Date' || p.amount !== 'Item Total' || p.customer !== 'Buyer') throw new Error('bad mapping');
  await page.getByRole('button', { name: /Review 2 rows/ }).click();
  const txt = await dlg().innerText();
  for (const s of ['Sep 13, 2026', 'New customer “Mia Park” will be added', 'Refund', '−$45.00']) if (!txt.includes(s)) throw new Error('missing ' + s);
  await page.getByRole('button', { name: 'Import 2 sales' }).click();
  await page.getByText('Imported 2 sales').first().waitFor();
});
await step('dashboard now shows imported revenue', async () => {
  await page.waitForTimeout(1200);
  // The 12-month chart total, so the check doesn't depend on today's date (the files are dated September 2026).
  const card = await page.locator('.card', { hasText: 'Revenue vs profit' }).first().innerText();
  console.log('     revenue chart:', card.split('\n').slice(0, 6).join(' | '));
  if (!card.includes('$400')) throw new Error('expected $400 total revenue');
  if (await page.getByText('Get started with Tokuma').count()) {
    const gs = await page.locator('.card', { hasText: 'Get started with Tokuma' }).innerText();
    if (!gs.includes('Log your first sale') || gs.match(/Log your first sale[\s\S]*Import sales/)) throw new Error('sale step not done');
  }
});
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO RUNTIME ERRORS');
await browser.close();
