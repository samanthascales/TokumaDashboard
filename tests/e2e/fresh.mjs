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
const step = async (name, fn) => { try { await fn(); console.log('OK  ', name); } catch (e) { console.log('FAIL', name, e.message.split('\n')[0]); } };

for (const r of ['', 'app', 'app/money', 'app/products', 'app/products/inventory', 'app/products/suppliers', 'app/circularity', 'app/reports', 'app/reports?tab=balance', 'app/reports?tab=cash', 'app/reports?tab=breakeven', 'app/learn', 'app/learn/funding', 'app/supply-chain/reliability', 'app/settings']) {
  await page.goto(B + r); await page.waitForTimeout(1300);
  await page.screenshot({ path: SP + '/empty-' + (r || 'landing').replace(/[/?=]/g, '_') + '.png' });
}
const land = await page.goto(B); await page.waitForTimeout(500);
await step('no 527 claim on landing', async () => { if ((await page.content()).includes('527')) throw new Error('527 still present'); });
await step('no sample names anywhere on empty app', async () => {
  for (const r of ['app', 'app/products/suppliers', 'app/money', 'app/reports', 'app/customers']) {
    await page.goto(B + r); await page.waitForTimeout(1000);
    const t = await page.content();
    for (const w of ['EcoFab', 'ThreadLoop', 'Alex Rivera', 'WoolCycle', 'Bamboo Crew']) if (t.includes(w)) throw new Error(w + ' on ' + r);
  }
});
await step('onboarding -> profile saved', async () => {
  await page.goto(B + 'onboarding');
  await page.getByPlaceholder('Jane Doe').fill('Sam Test');
  await page.getByPlaceholder('you@company.com').fill('sam@test.co');
  await page.getByPlaceholder('Founder & CEO').fill('Founder');
  await page.getByRole('button', { name: /Next step/ }).click();
  await page.getByPlaceholder('Your business name').fill('Loopy Goods');
  await page.getByPlaceholder('Canada').fill('Canada');
  await page.getByPlaceholder('e.g. We make bags').fill('We make bags from reclaimed sailcloth and canvas.');
  await page.getByRole('button', { name: /Next step/ }).click();
  await page.getByRole('button', { name: 'Reused canvas' }).click();
  await page.getByRole('button', { name: 'Reuse & resale' }).click();
  await page.getByRole('button', { name: /Next step/ }).click();
  await page.locator('select').first().selectOption('Pre-revenue');
  await page.getByRole('button', { name: /Finish/ }).click();
  await page.getByText('Good', { exact: false }).first().waitFor();
  await page.getByText('Loopy Goods', { exact: false }).first().waitFor();
});
await step('add supplier', async () => {
  await page.goto(B + 'app/products/suppliers?new=supplier'); await page.waitForTimeout(900);
  await page.getByPlaceholder('e.g. EcoFab Textiles').fill('Harbour Sailcloth');
  await page.getByRole('dialog').locator('label:has-text("Country") input').fill('Canada');
  await page.getByRole('button', { name: 'Add supplier' }).last().click();
  await page.getByText('Supplier added').waitFor();
});
await step('add product', async () => {
  await page.goto(B + 'app/products?new=product'); await page.waitForTimeout(900);
  const d = page.getByRole('dialog');
  await d.getByPlaceholder('e.g. Organic Cotton T-Shirt').fill('Sailcloth Tote');
  await d.locator('label:has-text("Price") input').fill('45');
  await d.locator('label:has-text("Unit cost") input').fill('12');
  await d.getByPlaceholder('Material name').fill('Reclaimed sailcloth');
  await d.getByPlaceholder('0.00').fill('0.4');
  await d.getByLabel('Material type', { exact: true }).selectOption('Reused');
  await d.locator('label:has-text("Supplier") select').selectOption({ label: 'Harbour Sailcloth' });
  await d.getByPlaceholder('Units in stock').fill('40');
  await page.getByRole('button', { name: 'Add product' }).last().click();
  await page.getByText('Product added').waitFor();
});
await step('log sale', async () => {
  await page.goto(B + 'app/money?new=txn'); await page.waitForTimeout(900);
  await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByText('Transaction logged').waitFor();
});
await step('dashboard after setup: checklist gone, numbers present', async () => {
  await page.goto(B + 'app'); await page.waitForTimeout(1500);
  if (await page.getByText('Get started with Tokuma').count()) throw new Error('checklist still shown');
  await page.getByText('$45').first().waitFor();
  await page.screenshot({ path: SP + '/after-setup.png' });
});
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO RUNTIME ERRORS');
await browser.close();
