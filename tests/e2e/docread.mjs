import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
// Reading materials from documents in the product form: text, PDF and photo (OCR).
// The app must be running at BASE_URL (see tests/README.md).
const SP = process.env.TEST_OUT ?? new URL('./output', import.meta.url).pathname;
const FIX = new URL('./fixtures', import.meta.url).pathname;
mkdirSync(SP, { recursive: true });
const B = process.env.BASE_URL ?? 'http://localhost:4173/#/';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await ctx.newPage();
const errors = [];
const outside = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('CERT')) errors.push(m.text()); });
// Documents are read on the device: nothing may be fetched from another host.
page.on('request', (r) => { const u = new URL(r.url()); if (/^https?:$/.test(u.protocol) && u.hostname !== 'localhost' && !u.hostname.endsWith('googleapis.com') && !u.hostname.endsWith('gstatic.com')) outside.push(r.url()); });
const step = async (name, fn) => { try { await fn(); console.log('OK  ', name); } catch (e) { console.log('FAIL', name, '—', e.message.split('\n')[0]); } };

const INVOICE_HTML = `<html><body style="font-family:Arial;font-size:30px;padding:40px;background:#fff;color:#000">
<h2>GreenThread Supplies Ltd</h2><p>INVOICE 2291</p>
<p>Recycled polyester yarn 25 kg</p><p>Organic cotton jersey 40 kg</p><p>Reclaimed denim offcuts 12 kg</p></body></html>`;

const openForm = async () => {
  await page.goto(B + 'app/products?new=product'); await page.waitForTimeout(900);
  const d = page.getByRole('dialog');
  await d.getByRole('button', { name: 'Scan a document' }).click();
  return d;
};
const readFile = async (d, file, timeout = 20000) => {
  await d.locator('#read-document-file').setInputFiles(file);
  await d.getByText(/materials found|No materials found/).waitFor({ timeout });
};

await step('document reading is optional: product saves without it', async () => {
  await page.goto(B + 'app/products?new=product'); await page.waitForTimeout(900);
  const d = page.getByRole('dialog');
  if (await d.getByTestId('read-document').count()) throw new Error('panel should be closed by default');
  await d.getByText('Have an invoice or receipt?').waitFor();
  await d.getByRole('button', { name: 'Scan a document' }).waitFor();
});

await step('Products page: "Add from an invoice" opens the form with the scanner ready', async () => {
  await page.goto(B + 'app/products'); await page.reload(); await page.waitForTimeout(900);
  await page.getByRole('button', { name: 'Add from an invoice' }).first().click();
  const panel = page.getByRole('dialog').getByTestId('read-document');
  await panel.getByRole('button', { name: 'Take a photo' }).waitFor();
  await panel.getByRole('button', { name: 'Upload a file' }).waitFor();
  await page.keyboard.press('Escape');
});

await step('text invoice: finds materials, types and weights', async () => {
  const d = await openForm();
  if (!(await d.getByTestId('read-document').innerText()).includes('Nothing is uploaded')) throw new Error('missing privacy note');
  await readFile(d, FIX + '/supplier_invoice.txt');
  const panel = d.getByTestId('read-document');
  await panel.getByText('4 materials found').waitFor();
  const names = await panel.getByLabel('Material name').evaluateAll((els) => els.map((e) => e.value));
  for (const n of ['Polyester', 'Organic cotton', 'Denim', 'Steel']) if (!names.includes(n)) throw new Error('missing ' + n + ' in ' + names);
  const types = await panel.getByLabel('Material type').evaluateAll((els) => els.map((e) => e.value));
  if (types.join() !== 'Recycled,Renewable,Reused,') throw new Error('types ' + types);
  if ((await panel.getByText('Check this').count()) !== 1) throw new Error('only the steel row (no type) should be flagged');
  await page.screenshot({ path: SP + '/docread-review.png' });
});

await step('review: per-product weights, unticked rows skipped, added to the form', async () => {
  const d = page.getByRole('dialog');
  const panel = d.getByTestId('read-document');
  await panel.getByLabel('Include Steel').uncheck();
  await panel.locator('label:has-text("How many products") input').fill('100');
  await panel.getByRole('button', { name: 'Add 3 materials' }).click();
  if (await d.getByTestId('read-document').count()) throw new Error('panel should close');
  const names = await d.getByPlaceholder('Material name').evaluateAll((els) => els.map((e) => e.value));
  const kg = await d.getByPlaceholder('0.00').evaluateAll((els) => els.map((e) => e.value));
  if (names.join() !== 'Polyester,Organic cotton,Denim') throw new Error('rows ' + names);
  if (kg.join() !== '0.25,0.4,0.12') throw new Error('weights ' + kg);
  // Every material is circular, so the preview score is 100.
  await d.locator('aside').getByText('100').waitFor();
});

await step('unsupported file shows a clear message', async () => {
  const d = await openForm();
  await d.locator('#read-document-file').setInputFiles({ name: 'notes.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from('x') });
  await d.getByText('This type of file can’t be read').waitFor();
});

await step('PDF invoice is read', async () => {
  const p2 = await ctx.newPage();
  await p2.setContent(INVOICE_HTML);
  writeFileSync(SP + '/invoice.pdf', await p2.pdf({ format: 'A4' }));
  await p2.close();
  const d = await openForm();
  await readFile(d, SP + '/invoice.pdf');
  await d.getByTestId('read-document').getByText('3 materials found').waitFor();
});

await step('photo of an invoice is read on the device (OCR)', async () => {
  const p2 = await ctx.newPage();
  await p2.setViewportSize({ width: 1000, height: 600 });
  await p2.setContent(INVOICE_HTML);
  await p2.screenshot({ path: SP + '/invoice.png' });
  await p2.close();
  const d = await openForm();
  await readFile(d, SP + '/invoice.png', 120000);
  const names = await d.getByTestId('read-document').getByLabel('Material name').evaluateAll((els) => els.map((e) => e.value));
  for (const n of ['Polyester', 'Organic cotton', 'Denim']) if (!names.includes(n)) throw new Error('OCR missed ' + n + ': ' + names);
  await page.screenshot({ path: SP + '/docread-ocr.png' });
});

await step('Spanish: labels and material names are translated', async () => {
  await page.evaluate(() => localStorage.setItem('tokuma-lang', 'es'));
  await page.goto(B + 'app/products?new=product'); await page.reload(); await page.waitForTimeout(900);
  const d = page.getByRole('dialog');
  await d.getByRole('button', { name: 'Escanear un documento' }).click();
  await d.locator('#read-document-file').setInputFiles(FIX + '/supplier_invoice.txt');
  await d.getByText('Se encontraron 4 materiales').waitFor();
  const names = await d.getByTestId('read-document').locator('input.input:not([type=number])').evaluateAll((els) => els.map((e) => e.value));
  if (!names.includes('Algodón orgánico')) throw new Error('names ' + names);
  await page.evaluate(() => localStorage.setItem('tokuma-lang', 'en'));
});

await step('mobile: the panel fits the screen', async () => {
  const m = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await m.goto(B + 'app/products?new=product'); await m.waitForTimeout(900);
  const d = m.getByRole('dialog');
  await d.getByRole('button', { name: 'Scan a document' }).click();
  await d.locator('#read-document-file').setInputFiles(FIX + '/supplier_invoice.txt');
  await d.getByText('4 materials found').waitFor();
  const [sw, cw] = await d.evaluate((el) => [el.scrollWidth, el.clientWidth]);
  if (sw > cw) throw new Error(`dialog scrolls sideways: ${sw} > ${cw}`);
  await m.close();
});

await step('no outside requests and no console errors', async () => {
  if (outside.length) throw new Error('outside requests: ' + outside.slice(0, 3).join(', '));
  if (errors.length) throw new Error(errors.slice(0, 3).join(' | '));
});
await browser.close();
