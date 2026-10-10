import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
// Screenshots go to tests/e2e/output (or TEST_OUT). The app must be running at BASE_URL (see tests/README.md).
const SP = process.env.TEST_OUT ?? new URL('./output', import.meta.url).pathname;
const FIX = new URL('./fixtures', import.meta.url).pathname;
const ROOT = new URL('../../', import.meta.url).pathname;
for (const d of ['', '/shots3', '/shots4']) mkdirSync(SP + d, { recursive: true });
const B = process.env.BASE_URL ?? 'http://127.0.0.1:4180/#/';
const MOCK = 'http://127.0.0.1:54321';
const browser = await chromium.launch();
const errors = [];
const newPage = async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/CERT|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  return page;
};
const step = async (name, fn) => { try { await fn(); console.log('OK  ', name); } catch (e) { console.log('FAIL', name, '—', e.message.split('\n')[0]); } };
const state = async () => (await fetch(MOCK + '/__test/state')).json();
const signUp = async (page, email, pw = 'correct-horse-1') => {
  await page.goto(B + 'signin?mode=signup');
  await page.locator('#auth-email').fill(email);
  await page.locator('#auth-password').fill(pw);
  await page.getByRole('button', { name: 'Create account' }).last().click();
};
const signIn = async (page, email, pw = 'correct-horse-1') => {
  await page.goto(B + 'signin');
  await page.locator('#auth-email').fill(email);
  await page.locator('#auth-password').fill(pw);
  await page.getByRole('button', { name: 'Sign in' }).last().click();
};
const waitDb = async (pred, what) => { for (let i = 0; i < 40; i++) { if (pred(await state())) return; await new Promise((r) => setTimeout(r, 200)); } throw new Error('database never had: ' + what); };
const saved = (page) => page.getByText('Saved', { exact: true }).waitFor({ timeout: 8000 });

const alice = await newPage();
await step('signed-out visitors are sent to sign in', async () => {
  await alice.goto(B + 'app/transactions');
  await alice.waitForURL(/#\/signin/);
});
await step('sign-up creates an account and a workspace, then onboarding', async () => {
  await signUp(alice, 'alice@shop.co');
  await alice.waitForURL(/#\/onboarding/, { timeout: 10000 });
  const s = await state();
  if (s.workspaces.length !== 1) throw new Error('workspaces=' + s.workspaces.length);
});
await step('changes save to the database and survive a reload', async () => {
  await alice.getByPlaceholder('Jane Doe').fill('Alice Ng');
  await alice.getByPlaceholder('you@company.com').fill('alice@shop.co');
  await alice.getByPlaceholder('Founder & CEO').fill('Founder');
  await alice.getByRole('button', { name: /Next step/ }).click();
  await alice.getByPlaceholder('Your business name').fill('Alice Goods');
  await alice.getByPlaceholder('Canada').fill('Canada');
  await alice.getByPlaceholder(/e.g. We make bags/).fill('We make bags from reclaimed sailcloth and canvas.');
  await alice.getByRole('button', { name: /Next step/ }).click();
  await alice.getByRole('button', { name: 'Reused canvas' }).click();
  await alice.getByRole('button', { name: 'Reuse & resale' }).click();
  await alice.getByRole('button', { name: /Next step/ }).click();
  await alice.locator('select').first().selectOption('Pre-revenue');
  await alice.getByRole('button', { name: /Finish/ }).click();
  await alice.waitForURL(/#\/app$/);
  await saved(alice);
  let s = await state();
  if (s.workspaces[0].business_name !== 'Alice Goods') throw new Error('business_name not saved: ' + s.workspaces[0].business_name);
  await alice.goto(B + 'app/supply-chain?new=supplier'); await alice.waitForTimeout(900);
  await alice.getByPlaceholder('e.g. EcoFab Textiles').fill('Harbour Sailcloth');
  await alice.getByRole('dialog').locator('label:has-text("Country") input').fill('Canada');
  await alice.getByRole('button', { name: 'Add supplier' }).last().click();
  await waitDb((st) => (st.workspaces[0].data.suppliers || []).some((x) => x.name === 'Harbour Sailcloth'), 'Harbour Sailcloth');
  await alice.reload();
  await alice.locator('main').getByText('Harbour Sailcloth').first().waitFor({ timeout: 8000 });
  s = await state();
  if ((s.workspaces[0].data.suppliers || []).length !== 1) throw new Error('supplier not in DB');
});
await step('support access is off by default; turning it on is saved', async () => {
  await alice.goto(B + 'app/settings?section=account'); await alice.waitForTimeout(800);
  await alice.getByText('No one from Tokuma has viewed your data.').waitFor();
  if ((await state()).workspaces[0].allow_support) throw new Error('allowed by default');
  await alice.getByLabel('Allow support access').click();
  await alice.getByText('Support access turned on').waitFor();
  if (!(await state()).workspaces[0].allow_support) throw new Error('not saved');
});

const bob = await newPage();
await step('existing browser data moves into a new account on first sign-in', async () => {
  await bob.goto(B);
  await bob.evaluate(() => localStorage.setItem('tokuma-state-v2', JSON.stringify({ suppliers: [{ id: 's9', name: 'Bob Local Supplier', country: 'US', city: '', transportMethod: 'Road', sustainabilityRating: null, carbonEmissionsKg: null, certifications: [], materialsSupplied: [], avgLeadTimeDays: null, onTimeDeliveryRate: null }], profile: { businessName: 'Bob Store' } })));
  await signUp(bob, 'bob@store.co');
  await bob.getByText('Moved this browser’s data into your account').waitFor({ timeout: 10000 });
  await bob.waitForTimeout(1500);
  const s = await state();
  const w = s.workspaces.find((x) => x.business_name === 'Bob Store');
  if (!w || w.data.suppliers?.[0]?.name !== 'Bob Local Supplier') throw new Error('not migrated');
  if (await bob.evaluate(() => localStorage.getItem('tokuma-state-v2'))) throw new Error('local copy not cleared');
});
await step('wrong password shows a clear message', async () => {
  const p = await newPage();
  await signIn(p, 'alice@shop.co', 'wrong-password-1');
  await p.getByText('That email and password don’t match an account.').waitFor();
});

const owner = await newPage();
await step('admin link is hidden for regular users', async () => {
  if (await alice.getByRole('link', { name: 'Admin' }).count()) throw new Error('alice sees admin');
});
await step('owner (admin) sees the directory; locked businesses cannot be opened', async () => {
  await signUp(owner, 'owner@tokuma.co');
  await owner.waitForURL(/#\/onboarding/);
  await fetch(MOCK + '/__test/make-admin', { method: 'POST', body: JSON.stringify({ email: 'owner@tokuma.co' }) });
  await owner.goto(B + 'app'); await owner.reload(); await owner.waitForTimeout(1500);
  await owner.getByRole('link', { name: 'Admin' }).click();
  await owner.getByText('Alice Goods').waitFor();
  const bobRow = await owner.locator('tr', { hasText: 'Bob Store' }).innerText();
  if (!bobRow.includes('Locked')) throw new Error('bob not locked: ' + bobRow);
  await owner.screenshot({ path: SP + '/shots3/admin.png' });
});
await step('opening needs a reason; support view is read-only and logged', async () => {
  await owner.locator('tr', { hasText: 'Alice Goods' }).getByRole('button', { name: 'Open' }).click();
  await owner.getByRole('button', { name: 'Open support view' }).click();
  await owner.getByText('Say briefly why').waitFor();
  await owner.locator('#admin-reason').fill('Checking supplier import issue');
  await owner.getByRole('button', { name: 'Open support view' }).click();
  await owner.getByText('Support view:').waitFor();
  await owner.goto(B + 'app/supply-chain');
  await owner.locator('main').getByText('Harbour Sailcloth').first().waitFor({ timeout: 8000 });
  await owner.screenshot({ path: SP + '/shots3/support-view.png' });
  // try an edit — must not be saved to Alice
  await owner.goto(B + 'app/supply-chain?new=supplier'); await owner.waitForTimeout(900);
  await owner.getByPlaceholder('e.g. EcoFab Textiles').fill('SHOULD NOT SAVE');
  await owner.getByRole('dialog').locator('label:has-text("Country") input').fill('X');
  await owner.getByRole('button', { name: 'Add supplier' }).last().click();
  await owner.waitForTimeout(2000);
  const s = await state();
  const a = s.workspaces.find((x) => x.business_name === 'Alice Goods');
  if (a.data.suppliers.some((x) => x.name === 'SHOULD NOT SAVE')) throw new Error('support-view edit was saved to Alice!');
  const own = s.workspaces.find((x) => x.owner_id !== a.owner_id && x.business_name === '');
  if (own && (own.data.suppliers || []).some((x) => x.name === 'SHOULD NOT SAVE')) throw new Error('saved into owner workspace');
  if (s.log.length !== 1 || s.log[0].reason !== 'Checking supplier import issue') throw new Error('not logged');
  await owner.getByRole('button', { name: /Exit support view/ }).click();
  await owner.waitForURL(/#\/app\/admin/);
  await owner.goto(B + 'app/supply-chain'); await owner.waitForTimeout(900);
  if ((await owner.locator('main').innerText()).includes('Harbour Sailcloth')) throw new Error('still showing alice data after exit');
});
await step('the business sees the view in its access history', async () => {
  await alice.goto(B + 'app/settings?section=account'); await alice.reload(); await alice.waitForTimeout(1500);
  await alice.getByText('Checking supplier import issue').waitFor();
});
await step('two tabs: a stale tab loads the newer data instead of overwriting it', async () => {
  const tab2 = await alice.context().newPage();
  await tab2.goto(B + 'app/supply-chain'); await tab2.waitForTimeout(1500);
  // tab 1 adds a supplier and saves
  await alice.goto(B + 'app/supply-chain?new=supplier'); await alice.waitForTimeout(900);
  await alice.getByPlaceholder('e.g. EcoFab Textiles').fill('From Tab One');
  await alice.getByRole('dialog').locator('label:has-text("Country") input').fill('Canada');
  await alice.getByRole('button', { name: 'Add supplier' }).last().click();
  await saved(alice);
  // tab 2 (stale) edits something
  await tab2.goto(B + 'app/supply-chain?new=supplier'); await tab2.waitForTimeout(900);
  await tab2.getByPlaceholder('e.g. EcoFab Textiles').fill('From Tab Two');
  await tab2.getByRole('dialog').locator('label:has-text("Country") input').fill('Canada');
  await tab2.getByRole('button', { name: 'Add supplier' }).last().click();
  await tab2.getByText('Loaded newer changes').waitFor({ timeout: 8000 });
  const s = await state();
  const names = s.workspaces.find((x) => x.business_name === 'Alice Goods').data.suppliers.map((x) => x.name);
  if (!names.includes('From Tab One')) throw new Error('tab one data lost: ' + names);
});
await step('sign out returns to the landing page and clears the data from the screen', async () => {
  await alice.goto(B + 'app/settings?section=account'); await alice.waitForTimeout(800);
  await alice.getByRole('button', { name: 'Sign out' }).click();
  await alice.waitForURL(/#\/$/);
  await alice.goto(B + 'app'); await alice.waitForURL(/#\/signin/);
});
console.log(errors.length ? 'ERRORS:\n' + [...new Set(errors)].join('\n') : 'NO RUNTIME ERRORS');
await browser.close();
