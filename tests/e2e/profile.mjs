import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
// Screenshots go to tests/e2e/output (or TEST_OUT). The app must be running at BASE_URL (see tests/README.md).
const SP = process.env.TEST_OUT ?? new URL('./output', import.meta.url).pathname;
const FIX = new URL('./fixtures', import.meta.url).pathname;
const ROOT = new URL('../../', import.meta.url).pathname;
for (const d of ['', '/shots3', '/shots4']) mkdirSync(SP + d, { recursive: true });
const B = process.env.BASE_URL ?? 'http://localhost:4173/#/';
const browser = await chromium.launch();
let failed = 0;
const step = async (name, fn) => { try { await fn(); console.log('OK  ', name); } catch (e) { failed++; console.log('FAIL', name, '—', e.message.split('\n')[0]); } };
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: 'en-US' });
await ctx.addInitScript(() => {
  if (!localStorage.getItem('seeded')) {
    localStorage.setItem('tokuma-state-v2', JSON.stringify({ profile: { ownerName: 'Ana Quispe', email: 'ana@awana.pe', role: 'Founder', businessName: 'Awana Textil', country: 'Peru', description: 'We make clothes from recycled cotton.', primaryMaterials: ['Recycled cotton'], circularModel: 'Recycled inputs', annualRevenue: '<$100k' } }));
    localStorage.setItem('seeded', '1');
  }
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(B + 'app'); await page.waitForTimeout(1200);
const photo = await page.screenshot(); // a real 1280×860 PNG to upload

await step('clicking your name opens a menu with your profile and Edit profile', async () => {
  await page.getByRole('button', { name: /Ana Quispe/ }).first().click();
  await page.getByRole('button', { name: 'Edit profile' }).waitFor({ timeout: 2000 }); await page.waitForTimeout(400);
  await page.screenshot({ path: SP + '/shots4/profile-menu.png', clip: { x: 900, y: 0, width: 380, height: 420 } });
});
await page.getByRole('button', { name: 'Edit profile' }).click();
await step('Edit profile opens the profile editor with saved details', async () => {
  await page.getByRole('dialog').getByText('Your profile').waitFor({ timeout: 2000 });
  if ((await page.locator('#profile-name').inputValue()) !== 'Ana Quispe') throw new Error('name not filled');
  if ((await page.locator('#profile-role').inputValue()) !== 'Founder') throw new Error('role not filled');
});
await step('a non-image file is rejected with a message', async () => {
  await page.locator('#profile-photo').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  await page.getByText('Choose an image file').waitFor({ timeout: 2000 });
});
await step('uploading a photo shows a square, small preview', async () => {
  await page.locator('#profile-photo').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: photo });
  const img = page.getByRole('dialog').locator('img').first();
  await img.waitFor({ timeout: 3000 });
  const src = await img.getAttribute('src');
  if (!src.startsWith('data:image/jpeg')) throw new Error('not a jpeg data url');
  const kb = (src.length * 3) / 4 / 1024;
  const dims = await img.evaluate((el) => [el.naturalWidth, el.naturalHeight]);
  if (dims[0] !== 256 || dims[1] !== 256) throw new Error('size ' + dims);
  if (kb > 80) throw new Error(kb + ' KB');
  console.log('     photo', Math.round(kb), 'KB', dims.join('×'));
});
await step('invalid phone is flagged on save and nothing is saved', async () => {
  await page.locator('#profile-phone').fill('abc');
  await page.getByRole('dialog').getByRole('button', { name: 'Save profile' }).click();
  await page.getByText('Enter a valid phone number').waitFor({ timeout: 2000 });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('tokuma-state-v2')).profile.avatar);
  if (saved) throw new Error('saved despite error');
});
await step('saving updates the top bar photo and details', async () => {
  await page.locator('#profile-phone').fill('+51 987 654 321');
  await page.locator('#profile-role').fill('Founder & CEO');
  await page.getByRole('dialog').getByRole('button', { name: 'Save profile' }).click();
  await page.getByText('Profile saved').waitFor({ timeout: 2000 });
  if (await page.getByRole('dialog').count()) throw new Error('modal still open');
  await page.locator('header img').first().waitFor({ timeout: 2000 });
  await page.screenshot({ path: SP + '/shots4/profile-topbar.png', clip: { x: 900, y: 0, width: 380, height: 70 } });
});
await step('profile survives a reload', async () => {
  await page.reload(); await page.waitForTimeout(1200);
  const p = await page.evaluate(() => JSON.parse(localStorage.getItem('tokuma-state-v2')).profile);
  if (!p.avatar.startsWith('data:image/jpeg') || p.phone !== '+51 987 654 321' || p.role !== 'Founder & CEO') throw new Error(JSON.stringify({ ...p, avatar: p.avatar.slice(0, 20) }));
  await page.locator('header img').first().waitFor({ timeout: 2000 });
});
await step('Settings opens on Your profile, and saving the business profile keeps the photo', async () => {
  await page.goto(B + 'app/settings'); await page.waitForTimeout(900);
  await page.locator('#profile-name').waitFor({ timeout: 2000 });
  await page.screenshot({ path: SP + '/shots4/profile-settings.png' });
  await page.getByRole('button', { name: 'Business profile', exact: true }).click();
  await page.getByLabel('Website').fill('awana.pe');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await page.waitForTimeout(400);
  const p = await page.evaluate(() => JSON.parse(localStorage.getItem('tokuma-state-v2')).profile);
  if (!p.avatar || p.website !== 'awana.pe' || p.phone !== '+51 987 654 321') throw new Error('lost fields ' + JSON.stringify({ ...p, avatar: (p.avatar||'').slice(0, 15) }));
});
await step('removing the photo goes back to initials', async () => {
  await page.getByRole('button', { name: 'Your profile', exact: true }).click();
  await page.getByRole('button', { name: 'Remove' }).click();
  await page.locator('main').getByRole('button', { name: 'Save profile' }).click();
  await page.waitForTimeout(400);
  const p = await page.evaluate(() => JSON.parse(localStorage.getItem('tokuma-state-v2')).profile);
  if (p.avatar) throw new Error('still has photo');
  if (await page.locator('header img').count()) throw new Error('topbar still shows image');
});
await step('works in Spanish too', async () => {
  await page.evaluate(() => localStorage.setItem('tokuma-lang', 'es'));
  await page.goto(B + 'app'); await page.reload(); await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /Ana Quispe/ }).first().click();
  await page.getByRole('button', { name: 'Editar perfil' }).click();
  await page.getByRole('dialog').getByText('Tu perfil').waitFor({ timeout: 2000 });
  await page.getByRole('dialog').getByText('Foto de perfil').waitFor({ timeout: 2000 });
});
await step('no page errors', async () => { if (errors.length) throw new Error(errors.join(' | ')); });
await browser.close();
console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
