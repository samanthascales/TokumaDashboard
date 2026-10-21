import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
// Screenshots go to tests/e2e/output (or TEST_OUT). The app must be running at BASE_URL (see tests/README.md).
const SP = process.env.TEST_OUT ?? new URL('./output', import.meta.url).pathname;
for (const d of ['', '/shots4']) mkdirSync(SP + d, { recursive: true });
const B = process.env.BASE_URL ?? 'http://localhost:4173/#/';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();
const errors = [];
const watch = (p) => {
  p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('CERT')) errors.push(m.text()); });
};
watch(page);
const step = async (name, fn) => { try { await fn(); console.log('OK  ', name); } catch (e) { console.log('FAIL', name, '—', e.message.split('\n')[0]); } };

const iso = (daysAgo) => { const d = new Date(); d.setDate(d.getDate() - daysAgo); return d.toISOString().slice(0, 10); };
const seed = {
  profile: { businessName: 'Loopy Goods', ownerName: 'Sam Test', industry: 'Fashion', country: 'Canada', description: 'Bags from reclaimed sailcloth.' },
  products: [{ id: 'p1', name: 'Half Tote', sku: 'HT-1', category: 'Bags', price: 50, unitCost: 20, materials: [{ name: 'Recycled cotton', weightKg: 0.5, recycled: true, reused: false }, { name: 'New cotton', weightKg: 0.5, recycled: false, reused: false }], circularityScore: 50, stockOnHand: 10, lowStockThreshold: 0, safetyStock: 0 }],
  transactions: [
    { id: 't0', type: 'inflow', category: 'Product sale', amount: 50, productId: 'p1', quantity: 1, date: iso(45) },
    { id: 't1', type: 'inflow', category: 'Product sale', amount: 100, productId: 'p1', quantity: 2, date: iso(5) },
    { id: 't2', type: 'inflow', category: 'Repair service', amount: 100, date: iso(3) },
    { id: 't3', type: 'outflow', category: 'Rent & utilities', amount: 50, date: iso(2) },
  ],
};
await page.addInitScript((s) => {
  if (!localStorage.getItem('seeded')) {
    localStorage.setItem('tokuma-state-v2', s);
    localStorage.setItem('seeded', '1');
  }
}, JSON.stringify(seed));

const readinessScore = async () => +(await page.getByTestId('readiness-score').innerText());
const item = async (label) => (await page.getByTestId('readiness').locator('li', { hasText: label }).first().innerText()).replace(/\n/g, ' ');

await step('funding readiness: the meter adds up its checklist', async () => {
  await page.goto(B + 'app/learn/funding'); await page.waitForTimeout(1500);
  const score = await readinessScore();
  const pts = await page.getByTestId('readiness').locator('ul').first().locator('li').allInnerTexts();
  const sum = pts.map((t) => +(t.match(/(\d+)\/\d+\s*$/)?.[1] ?? 0)).reduce((a, b) => a + b, 0);
  if (score !== sum) throw new Error(`score ${score} but items add to ${sum}`);
  // 45 days of sales out of 90 → 8 of 15 points.
  if (!(await item('3 months of sales recorded')).includes('8/15')) throw new Error('sales ' + (await item('3 months of sales recorded')));
  if (!(await item('Opening cash balance entered')).includes('0/5')) throw new Error('cash should be 0/5');
  if (!(await page.getByTestId('readiness').innerText()).includes('not a credit score or a loan offer')) {
    await page.getByRole('button', { name: 'What does “Funding readiness” mean?' }).click();
    await page.getByRole('tooltip').getByText('not a credit score or a loan offer', { exact: false }).waitFor();
    await page.keyboard.press('Escape');
  }
  await page.screenshot({ path: SP + '/shots4/readiness.png' });
});
await step('adding the opening cash balance raises readiness by 5', async () => {
  const before = await readinessScore();
  await page.goto(B + 'app/reports?tab=balance'); await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Add opening balance' }).click();
  await page.getByRole('dialog').locator('input').fill('1000');
  await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByText('Opening balance saved').waitFor();
  await page.goto(B + 'app/learn/funding'); await page.waitForTimeout(1300);
  const after = await readinessScore();
  if (!(await item('Opening cash balance entered')).includes('5/5')) throw new Error('cash item');
  // Cash runway also moves once cash is known, so the total rises by at least 5.
  if (after < before + 5) throw new Error(`${before} → ${after}`);
});

let lenderLink = '';
await step('lender report: preview shows what is switched on', async () => {
  await page.goto(B + 'app/share'); await page.waitForTimeout(900);
  const v = await page.getByTestId('report-view').innerText();
  for (const s of ['Lender & investor report', 'Loopy Goods', 'Fashion · Canada', 'Financial summary (last 30 days)', 'Balance sheet', 'Funding readiness', 'Circularity score', 'Half Tote']) if (!v.includes(s)) throw new Error('preview missing ' + s);
  await page.getByRole('switch', { name: 'Balance sheet' }).click().catch(() => page.getByLabel('Balance sheet').click());
  await page.waitForTimeout(200);
  if (await page.getByTestId('report-balance').count()) throw new Error('balance sheet still shown');
  await page.getByLabel('Message (optional)').fill('Hi Ana, here is our October snapshot.');
  lenderLink = await page.getByTestId('open-link').getAttribute('href');
  if (!lenderLink.includes('#/r/')) throw new Error('bad link ' + lenderLink);
  await page.screenshot({ path: SP + '/shots4/share-page.png', fullPage: true });
});
await step('the link opens read-only for someone with no account or data', async () => {
  const other = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  watch(other);
  await other.goto(lenderLink); await other.waitForTimeout(1200);
  const v = await other.getByTestId('report-view').innerText();
  for (const s of ['Loopy Goods', 'Hi Ana, here is our October snapshot.', 'Revenue', '$250', 'Net profit', 'Read-only snapshot from']) if (!v.includes(s)) throw new Error('viewer missing ' + s);
  if (await other.getByTestId('report-balance').count()) throw new Error('balance sheet was switched off');
  if (await other.locator('aside').count()) throw new Error('viewer shows the app menu');
  const stored = await other.evaluate(() => localStorage.getItem('tokuma-state-v2'));
  if (stored && stored.includes('Loopy Goods')) throw new Error('report data was saved into the viewer’s browser');
  await other.screenshot({ path: SP + '/shots4/shared-lender.png', fullPage: true });
  await other.close();
});
await step('impact report has the circularity story and no financial figures', async () => {
  await page.goto(B + 'app/share?type=impact'); await page.waitForTimeout(900);
  const link = await page.getByTestId('open-link').getAttribute('href');
  const other = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  watch(other);
  await other.goto(link); await other.waitForTimeout(1200);
  const v = await other.getByTestId('report-view').innerText();
  for (const s of ['Circularity impact report', 'Circular materials', 'Waste kept out of landfill', 'Circular inflow']) if (!v.includes(s)) throw new Error('impact missing ' + s);
  for (const s of ['Revenue', 'Net profit', 'Balance sheet', 'Funding readiness']) if (v.includes(s)) throw new Error('impact report shows ' + s);
  const overflow = await other.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 1) throw new Error('phone overflow ' + overflow);
  await other.screenshot({ path: SP + '/shots4/shared-impact-mobile.png', fullPage: true });
  await other.close();
});
await step('an edited or broken link shows a clear message', async () => {
  const other = await (await browser.newContext()).newPage();
  await other.goto(B + 'r/not-a-real-report'); await other.waitForTimeout(800);
  await other.getByText('This report link is incomplete').waitFor();
  // A link whose text was edited into something harmful is shown as text, never run.
  const evil = Buffer.from(JSON.stringify({ v: 1, kind: 'impact', business: { name: '<img src=x onerror=window.__pwned=1>' }, circularity: { pillars: [] } })).toString('base64url');
  await other.goto(B + 'r/' + evil); await other.waitForTimeout(800);
  if (await other.evaluate(() => window.__pwned)) throw new Error('script ran');
  await other.getByText('<img src=x onerror=window.__pwned=1>').waitFor();
  await other.close();
});
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO RUNTIME ERRORS');
await browser.close();
