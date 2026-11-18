import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
// Open-ended setup: a service business with no products, and free-text profile fields.
// The app must be running at BASE_URL (see tests/README.md).
const SP = process.env.TEST_OUT ?? new URL('./output', import.meta.url).pathname;
mkdirSync(SP, { recursive: true });
const B = process.env.BASE_URL ?? 'http://localhost:4173/#/';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('CERT')) errors.push(m.text()); });
const step = async (name, fn) => { try { await fn(); console.log('OK  ', name); } catch (e) { console.log('FAIL', name, '—', e.message.split('\n')[0]); } };

await step('onboarding: the business is described in the owner’s own words', async () => {
  await page.goto(B + 'onboarding'); await page.waitForTimeout(600);
  await page.getByPlaceholder('Your business name').fill('Fix It Bikes');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('What does your business do?').first().waitFor();
  await page.getByPlaceholder('e.g. We repair bikes and sell used parts').fill('Bike repair shop');
  await page.getByRole('button', { name: /^Services/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  // A service business is not pushed to add a product first.
  if (await page.getByRole('button', { name: /Add a product/ }).count()) throw new Error('product choice shown to a service business');
  await page.screenshot({ path: SP + '/services-onboarding.png' });
  await page.getByRole('button', { name: /Look around first/ }).click();
  await page.getByText('Good', { exact: false }).first().waitFor();
});

await step('setup checklist: a sale and the waste, no product needed', async () => {
  const gs = await page.getByTestId('getting-started').innerText();
  if (!gs.includes('Record your first sale') || !gs.includes('Record your waste') || gs.includes('Add a product\n')) throw new Error('checklist: ' + gs.replace(/\n/g, ' | '));
});

await step('a first sale with no products is a service sale', async () => {
  await page.goto(B + 'app/money?new=txn'); await page.waitForTimeout(900);
  const d = page.getByRole('dialog');
  await d.locator('label:has-text("Amount") input').fill('80');
  await d.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByText('Transaction logged').waitFor();
  await page.getByRole('cell', { name: 'Service sale' }).first().waitFor().catch(async () => { await page.getByText('Service sale').first().waitFor(); });
});

await step('waste from the checklist opens the waste form; product parts say "not used"', async () => {
  await page.goto(B + 'app/circularity?new=waste'); await page.waitForTimeout(1200);
  const d = page.getByRole('dialog');
  await d.locator('label:has-text("What was it?") input').fill('Old tyres');
  await d.locator('label:has-text("Weight (kg)") input').fill('5');
  await d.locator('label:has-text("Where did it go?") select').selectOption('Recycle or compost');
  await d.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByText('Waste record added').first().waitFor();
  for (const k of ['inflow', 'life', 'productivity']) {
    const t = await page.getByTestId('pillar-' + k).innerText();
    if (!t.includes('not used') || !t.includes('Only for businesses that sell products.')) throw new Error(k + ': ' + t);
  }
  if (!(await page.getByTestId('pillar-outflow').innerText()).includes('50')) throw new Error('outflow not measured');
  await page.screenshot({ path: SP + '/services-circularity.png', fullPage: true });
});

await step('funding readiness does not ask a service business for products', async () => {
  await page.goto(B + 'app/learn/funding'); await page.waitForTimeout(1200);
  const r = await page.getByTestId('readiness').innerText();
  if (!/Products listed \(not needed for services\)\s+10\/10/.test(r)) throw new Error('products item: ' + r.slice(0, 400));
  if (!r.includes('At least 2 parts of the circularity score measured')) throw new Error('circularity item');
});

await step('settings: type of business and materials are free text', async () => {
  await page.goto(B + 'app/settings?section=profile'); await page.waitForTimeout(900);
  const type = page.getByPlaceholder('e.g. Bike repair shop');
  if ((await type.inputValue()) !== 'Bike repair shop') throw new Error('type ' + (await type.inputValue()));
  await page.getByPlaceholder('Type a material, e.g. coffee grounds').fill('Rubber inner tubes');
  await page.keyboard.press('Enter');
  await page.getByText('Rubber inner tubes').first().waitFor();
  await page.getByPlaceholder('e.g. We repair and resell used bikes').fill('We fix bikes so they last longer');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await page.getByText('All changes saved').waitFor();
});

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO RUNTIME ERRORS');
await browser.close();
