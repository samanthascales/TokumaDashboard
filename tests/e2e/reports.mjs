import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
// Screenshots go to tests/e2e/output (or TEST_OUT). The app must be running at BASE_URL (see tests/README.md).
const SP = process.env.TEST_OUT ?? new URL('./output', import.meta.url).pathname;
for (const d of ['', '/shots3', '/shots4']) mkdirSync(SP + d, { recursive: true });
const B = process.env.BASE_URL ?? 'http://localhost:4173/#/';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('CERT')) errors.push(m.text()); });
const step = async (name, fn) => { try { await fn(); console.log('OK  ', name); } catch (e) { console.log('FAIL', name, '—', e.message.split('\n')[0]); } };

// Dates relative to today so every check falls inside "the last 30 days".
const iso = (daysAgo) => { const d = new Date(); d.setDate(d.getDate() - daysAgo); return d.toISOString().slice(0, 10); };
const seed = {
  profile: { businessName: 'Loopy Goods', ownerName: 'Sam Test' },
  products: [{ id: 'p1', name: 'Half Tote', sku: 'HT-1', category: 'Bags', price: 50, unitCost: 20, materials: [{ name: 'Recycled cotton', weightKg: 0.5, recycled: true, reused: false }, { name: 'New cotton', weightKg: 0.5, recycled: false, reused: false }], circularityScore: 50, stockOnHand: 10, lowStockThreshold: 0, safetyStock: 0 }],
  suppliers: [{ id: 's1', name: 'Rated Supplier', country: 'Canada', city: '', transportMethod: 'Road', sustainabilityRating: 80, carbonEmissionsKg: null, certifications: [], materialsSupplied: [], avgLeadTimeDays: null, onTimeDeliveryRate: null }],
  transactions: [
    { id: 't1', type: 'inflow', category: 'Product sale', amount: 100, productId: 'p1', quantity: 2, date: iso(5) },
    { id: 't2', type: 'inflow', category: 'Repair service', amount: 100, date: iso(3) },
    { id: 't3', type: 'outflow', category: 'Rent & utilities', amount: 50, date: iso(2) },
    { id: 't4', type: 'inflow', category: 'Loan', amount: 400, date: iso(1) },
  ],
  openingCash: 1000,
};
await page.addInitScript((s) => {
  if (!localStorage.getItem('seeded')) {
    localStorage.setItem('tokuma-state-v2', s);
    localStorage.setItem('seeded', '1');
  }
}, JSON.stringify(seed));

const pillar = async (k) => (await page.getByTestId('pillar-' + k).innerText()).replace(/\n/g, ' ');
const sidebarScore = async () => (await page.locator('aside').innerText()).match(/Circularity score\s+(\S+)/)?.[1];
await step('circularity score: three measured pillars, geometric mean', async () => {
  // inflow 0.5 (half recycled) · productivity $100 per kg of new material → 0.65 on the $5–$500 log scale ·
  // business model 0.5 (repair revenue is half of total revenue). Outflow and product life aren't measured yet.
  await page.goto(B + 'app'); await page.waitForTimeout(1200);
  if ((await sidebarScore()) !== '55') throw new Error('sidebar score ' + (await sidebarScore()));
  await page.goto(B + 'app/circularity'); await page.waitForTimeout(2200);
  const b = await page.getByTestId('score-breakdown').innerText();
  for (const s of ['55', 'Circular Grower', 'Research-based']) if (!b.includes(s)) throw new Error('breakdown missing ' + s);
  if (!(await pillar('inflow')).includes('50')) throw new Error('inflow ' + (await pillar('inflow')));
  if (!(await pillar('inflow')).includes('world average 6.9%')) throw new Error('no global benchmark');
  if (!(await pillar('productivity')).includes('65') || !(await pillar('productivity')).includes('$100.00 revenue per kg')) throw new Error('productivity ' + (await pillar('productivity')));
  if (!(await pillar('outflow')).includes('not measured yet')) throw new Error('outflow should be unmeasured');
  if (!(await pillar('life')).includes('not measured yet')) throw new Error('life should be unmeasured');
  await page.screenshot({ path: SP + '/shots4/score-breakdown.png' });
});
await step('waste sent to landfill pulls the score down; reuse lifts it', async () => {
  const add = async (what, kg, route) => {
    await page.getByTestId('waste-log').getByRole('button', { name: 'Record waste' }).click();
    const d = page.getByRole('dialog');
    await d.locator('label:has-text("What was it?") input').fill(what);
    await d.locator('label:has-text("Weight (kg)") input').fill(String(kg));
    await d.locator('label:has-text("Where did it go?") select').selectOption(route);
    await d.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByText('Waste record added').first().waitFor();
    await page.waitForTimeout(1600);
  };
  await add('Packaging', 2, 'Landfill or incineration');
  // A measured zero counts as 0.01, so the geometric score drops to 20 while a plain average would give 41.
  if ((await sidebarScore()) !== '20') throw new Error('after landfill ' + (await sidebarScore()));
  if (!(await page.getByTestId('score-range').innerText()).includes('Between 20 and 41')) throw new Error('range');
  await add('Offcuts', 8, 'Reuse or repair');
  // (8 kg × 1 + 2 kg × 0) / 10 kg = 0.8 → score 60.
  if (!(await pillar('outflow')).includes('80')) throw new Error('outflow ' + (await pillar('outflow')));
  if ((await sidebarScore()) !== '60') throw new Error('after reuse ' + (await sidebarScore()));
  await page.screenshot({ path: SP + '/shots4/waste-log.png', fullPage: true });
});
await step('product life fills the fifth pillar', async () => {
  await page.goto(B + 'app/products?open=p1'); await page.waitForTimeout(900);
  const d = page.getByRole('dialog');
  await d.getByLabel('Lasts (years)', { exact: true }).fill('4');
  await d.getByLabel('A typical one lasts (years)', { exact: true }).fill('2');
  await d.getByRole('button', { name: 'Save changes' }).click();
  await page.getByText('Product updated').waitFor();
  await page.goto(B + 'app/circularity'); await page.waitForTimeout(2200);
  // Lasts twice as long as a typical product → X = 2 → full marks; five pillars → 67.
  if (!(await pillar('life')).includes('100') || !(await pillar('life')).includes('2.0× the life')) throw new Error('life ' + (await pillar('life')));
  if ((await sidebarScore()) !== '67') throw new Error('five pillars ' + (await sidebarScore()));
  await page.getByTestId('research-basis').getByText('How the score is built').click();
  await page.getByText('ISO 59020', { exact: false }).first().waitFor();
});
await step('dashboard shows profit and the score side by side; loans are not profit', async () => {
  await page.goto(B + 'app'); await page.waitForTimeout(1200);
  const profit = await page.getByTestId('home-profit').innerText();
  if (profit !== '$150') throw new Error('profit ' + profit);
  if (!(await page.locator('main').innerText()).includes('Revenue was $150 more than expenses.')) throw new Error('missing plain sentence');
});
await step('goals: set both, progress bars appear', async () => {
  await page.getByRole('button', { name: 'Goals' }).click();
  const d = page.getByRole('dialog');
  await d.locator('label:has-text("Monthly net profit goal") input').fill('300');
  await d.locator('label:has-text("Circularity score goal") input').fill('70');
  await d.getByRole('button', { name: 'Save goals' }).click();
  await page.getByText('Goals saved').waitFor();
  const t = await page.locator('main').innerText();
  for (const s of ['Goal: $300 net profit a month', '50% of goal', 'Goal: a score of 70', '96% of goal']) if (!t.includes(s)) throw new Error('missing ' + s);
});
await step('explanations open on hover, close on Escape, and toggle on tap', async () => {
  await page.waitForTimeout(600); // let the goals dialog finish closing
  const btn = page.getByRole('button', { name: 'What does “Net profit” mean?' }).first();
  await btn.hover();
  await page.getByRole('tooltip').getByText('Net profit is revenue', { exact: false }).waitFor({ timeout: 2000 }).catch(() => { throw new Error('hover did not open the explanation'); });
  await page.screenshot({ path: SP + '/shots4/explain-hover.png' });
  await page.keyboard.press('Escape');
  await page.getByRole('tooltip').waitFor({ state: 'detached', timeout: 2000 }).catch(() => { throw new Error('Escape did not close it'); });
  const m = await (await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })).newPage();
  await m.addInitScript((s) => localStorage.setItem('tokuma-state-v2', s), JSON.stringify(seed));
  await m.goto(B + 'app'); await m.waitForTimeout(1200);
  const mb = m.getByRole('button', { name: 'What does “Circularity score” mean?' }).first();
  await mb.tap();
  await m.getByRole('tooltip').getByText('how circular your business is', { exact: false }).waitFor({ timeout: 2000 }).catch(() => { throw new Error('tap did not open it'); });
  const box = await m.getByRole('tooltip').boundingBox();
  if (box.x < 0 || box.x + box.width > 390) throw new Error('tooltip off-screen ' + JSON.stringify(box));
  await m.screenshot({ path: SP + '/shots4/explain-tap-mobile.png' });
  await mb.tap();
  await m.getByRole('tooltip').waitFor({ state: 'detached', timeout: 2000 }).catch(() => { throw new Error('second tap did not close it'); });
  await m.close();
});
await step('profit & loss lists revenue and expenses by category; the loan is kept apart', async () => {
  await page.goto(B + 'app/reports'); await page.waitForTimeout(800);
  const t = await page.getByTestId('pnl').innerText();
  for (const s of ['Product sale', 'Repair service', 'Total revenue\n$200', 'Rent & utilities', 'Total expenses\n$50', 'Financing (not revenue)', 'Loan']) if (!t.includes(s)) throw new Error('missing ' + JSON.stringify(s));
  if ((await page.getByTestId('pnl-profit').innerText()) !== '$150') throw new Error('profit');
  const side = await page.locator('main').innerText();
  if (!side.includes('For every $1 of revenue, you kept 75¢ as profit.')) throw new Error('margin sentence');
  if (!side.includes('50% of your revenue.')) throw new Error('circular income share');
  await page.screenshot({ path: SP + '/shots4/report-pnl.png', fullPage: true });
});
await step('balance sheet: assets − liabilities = owner’s equity', async () => {
  await page.getByRole('tab', { name: 'Balance sheet' }).click(); await page.waitForTimeout(400);
  // cash 1000 + 200 + 400 − 50 = 1550; inventory 10 × $20 = 200
  let own = await page.getByTestId('assets').innerText();
  if (!own.includes('$1,550') || !own.includes('$200') || !own.includes('$1,750')) throw new Error('assets ' + own.replace(/\n/g, ' | '));
  await page.getByTestId('assets').getByRole('button', { name: 'Add' }).click();
  let d = page.getByRole('dialog');
  await d.locator('label:has-text("Name") input').fill('Sewing machine');
  await d.locator('label:has-text("Current value") input').fill('500');
  await d.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByTestId('liabilities').getByRole('button', { name: 'Add' }).click();
  d = page.getByRole('dialog');
  await d.locator('label:has-text("Name") input').fill('Bank loan');
  await d.locator('label:has-text("Amount owed") input').fill('400');
  await d.getByRole('button', { name: 'Add', exact: true }).click();
  await page.waitForTimeout(300);
  const eq = await page.getByTestId('equity').innerText();
  if (eq !== '$1,850') throw new Error('equity ' + eq);
  await page.reload(); await page.waitForTimeout(900);
  if ((await page.getByTestId('equity').innerText()) !== '$1,850') throw new Error('not saved');
  await page.screenshot({ path: SP + '/shots4/report-balance.png', fullPage: true });
});
await step('cash flow: cash today and how long it would last', async () => {
  await page.getByRole('tab', { name: 'Cash flow' }).click(); await page.waitForTimeout(500);
  const t = await page.locator('main').innerText();
  if (!t.includes('$1,550')) throw new Error('cash today');
  // spent $50 in 90 days → $16.67 a month → 1550 / 16.67 = 93 months
  if (!/93(\.\d)? months/.test(t)) throw new Error('runway: ' + (t.match(/[\d.]+ months/) ?? ['none'])[0]);
});
await step('break-even: fixed costs ÷ profit per unit', async () => {
  await page.getByRole('tab', { name: 'Break-even' }).click(); await page.waitForTimeout(400);
  await page.getByTestId('be-fixed').fill('600');
  await page.getByTestId('be-per').fill('20');
  if ((await page.getByTestId('be-units').innerText()) !== '30') throw new Error('units');
  await page.getByTestId('be-per').fill('-1');
  await page.getByText('Each item costs more than you sell it for').waitFor();
});
await step('learn: a lesson opens and links to its report', async () => {
  await page.goto(B + 'app/learn?tab=library'); await page.waitForTimeout(900);
  await page.getByText('Your balance sheet in plain words').click();
  await page.getByRole('dialog').getByText('Assets: your cash', { exact: false }).waitFor();
  await page.getByRole('button', { name: 'Open your balance sheet' }).click();
  await page.waitForURL(/tab=balance/);
});
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO RUNTIME ERRORS');
await browser.close();
