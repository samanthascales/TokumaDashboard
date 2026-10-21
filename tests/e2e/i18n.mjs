import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
// Screenshots go to tests/e2e/output (or TEST_OUT). The app must be running at BASE_URL (see tests/README.md).
const SP = process.env.TEST_OUT ?? new URL('./output', import.meta.url).pathname;
const FIX = new URL('./fixtures', import.meta.url).pathname;
const ROOT = new URL('../../', import.meta.url).pathname;
for (const d of ['', '/shots3', '/shots4']) mkdirSync(SP + d, { recursive: true });
const B = process.env.BASE_URL ?? 'http://localhost:4173/#/';
const keys = JSON.parse(execFileSync('node', [ROOT + 'scripts/i18n-keys.mjs', '--json'], { encoding: 'utf8' }));
const browser = await chromium.launch();
let failed = 0;
const step = async (name, fn) => { try { await fn(); console.log('OK  ', name); } catch (e) { failed++; console.log('FAIL', name, '—', e.message.split('\n')[0]); } };

// Seed a small business so every page has content.
const iso = (d) => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);
const seed = {
  profile: { ownerName: 'Ana Quispe', email: 'ana@ejemplo.pe', role: 'Fundadora', businessName: 'Awana Textil', industry: 'Apparel & Textiles', country: 'Perú', founded: '2020', description: 'Hacemos ropa con algodón reciclado y reparamos gratis.', website: 'awana.pe', employees: '2–5', primaryMaterials: ['Recycled cotton'], circularModel: 'Recycled inputs', annualRevenue: '<$100k', fundingGoal: '20000', bankConnected: false },
  products: [
    { id: 'p1', name: 'Chompa Andina', sku: 'AW-01', category: 'Tops', price: 40, unitCost: 15, materials: [{ name: 'Algodón reciclado', weightKg: 0.4, recycled: true, reused: false }, { name: 'Botones', weightKg: 0.05, recycled: false, reused: false }], circularityScore: 89, stockOnHand: 3, lowStockThreshold: 5, safetyStock: 2, supplierId: 's1' },
    { id: 'p2', name: 'Bolso Telar', sku: 'AW-02', category: 'Accessories', price: 25, unitCost: 8, materials: [{ name: 'Lana virgen', weightKg: 0.3, recycled: false, reused: false }], circularityScore: 0, stockOnHand: 40, lowStockThreshold: 5, safetyStock: 5, supplierId: 's2' },
  ],
  suppliers: [
    { id: 's1', name: 'Hilados Cusco', country: 'Perú', city: 'Cusco', transportMethod: 'Road', sustainabilityRating: 80, carbonEmissionsKg: 1200, certifications: ['GRS'], materialsSupplied: ['Algodón reciclado'], avgLeadTimeDays: 10, onTimeDeliveryRate: 92 },
    { id: 's2', name: 'Lanas Puno', country: 'Perú', city: 'Puno', transportMethod: 'Air', sustainabilityRating: 50, carbonEmissionsKg: 4000, certifications: [], materialsSupplied: ['Lana'], avgLeadTimeDays: 30, onTimeDeliveryRate: 60 },
  ],
  customers: [{ id: 'c1', name: 'Rosa Mamani', email: 'rosa@ejemplo.pe', city: 'Lima', joinedDate: iso(200) }],
  transactions: [
    ...Array.from({ length: 20 }, (_, i) => ({ id: 't' + i, type: 'inflow', category: 'Product sale', amount: 40 * 2, productId: 'p1', quantity: 2, customerId: i % 3 ? undefined : 'c1', date: iso(i * 9) })),
    ...Array.from({ length: 8 }, (_, i) => ({ id: 'u' + i, type: 'inflow', category: 'Product sale', amount: 25, productId: 'p2', quantity: 1, date: iso(i * 11 + 2) })),
    { id: 'x1', type: 'outflow', category: 'Materials', amount: 300, date: iso(5) },
    { id: 'x2', type: 'outflow', category: 'Rent & utilities', amount: 500, date: iso(12) },
  ],
  fundingRequests: [{ id: 'f1', type: 'Loan', amount: 5000, purpose: 'Más máquinas de coser', submittedDate: iso(3), status: 'Pending' }],
  role: 'business',
};

const pages = ['', 'app', 'app/money', 'app/products', 'app/products/inventory', 'app/products/suppliers', 'app/circularity', 'app/reports', 'app/reports?tab=balance', 'app/reports?tab=cash', 'app/reports?tab=breakeven', 'app/supply-chain/reliability', 'app/learn', 'app/learn?tab=library', 'app/learn/diagnostic', 'app/learn/modules/sustainability', 'app/learn/funding', 'app/share', 'app/share?type=impact', 'app/customers', 'app/settings', 'app/investor', 'signin', 'onboarding'];

async function ctxFor(lang, locale = 'en-US') {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale });
  await ctx.addInitScript(([s, l]) => {
    if (!localStorage.getItem('seeded')) {
      localStorage.setItem('tokuma-state-v2', s);
      if (l) localStorage.setItem('tokuma-lang', l);
      localStorage.setItem('seeded', '1');
    }
  }, [JSON.stringify(seed), lang]);
  return ctx;
}

// Visible text segments that are exactly an English UI string (so it wasn't translated).
async function englishLeftovers(page, dict) {
  const texts = await page.evaluate(() => {
    const out = new Set();
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walk.nextNode())) {
      const el = n.parentElement;
      if (!el || el.closest('script,style,[aria-hidden="true"]')) continue;
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden') continue;
      const t = n.textContent.trim();
      if (t) out.add(t);
    }
    for (const el of document.querySelectorAll('[placeholder],[aria-label],[title]')) for (const a of ['placeholder', 'aria-label', 'title']) if (el.getAttribute(a)) out.add(el.getAttribute(a).trim());
    return [...out];
  });
  return texts.filter((t) => keys.includes(t) && !/\{/.test(t) && dict[t] !== undefined && dict[t] !== t);
}

// Negative control: the leftover detector must flag an English page when checked against Spanish.
{
  const dict = (await import(`${ROOT}src/i18n/locales/es.ts`)).es;
  const ctx = await ctxFor(null);
  const page = await ctx.newPage();
  await page.goto(B + 'app'); await page.waitForTimeout(1200);
  const found = await englishLeftovers(page, dict);
  await step(`detector catches English text (found ${found.length} on the English dashboard)`, async () => { if (found.length < 20) throw new Error('detector too weak'); });
  await ctx.close();
}
{
  const ctx = await ctxFor('fr');
  const page = await ctx.newPage();
  await page.goto(B + 'app/learn/funding'); await page.waitForTimeout(1500);
  await step('French: money and decimals use French formatting on seeded data', async () => {
    const txt = await page.locator('main').innerText();
    if (!/\d,\d{2}[\u202f\u00a0]%/.test(txt)) throw new Error('no "x,xx %" found');
    if (!/\$US|\$/.test(txt)) throw new Error('no currency');
  });
  await ctx.close();
}

const langs = { es: 'Buenos', pt: 'Bom', fr: 'Bon', ar: 'صباح', nl: 'Goed' };
for (const [lang] of Object.entries(langs)) {
  const dict = (await import(`${ROOT}src/i18n/locales/${lang}.ts`))[lang];
  const ctx = await ctxFor(lang);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const leftovers = new Map();
  for (const p of pages) {
    await page.goto(B + p);
    await page.waitForTimeout(p.startsWith('app') ? 1100 : 500);
    for (const t of await englishLeftovers(page, dict)) leftovers.set(t, (leftovers.get(t) ?? '') + ' ' + (p || '/'));
  }
  // A few dialogs too.
  await page.goto(B + 'app/products'); await page.waitForTimeout(1000);
  await page.locator('main button.btn-primary').first().click(); await page.waitForTimeout(400);
  for (const t of await englishLeftovers(page, dict)) leftovers.set(t, (leftovers.get(t) ?? '') + ' product-modal');
  await page.keyboard.press('Escape');
  await page.goto(B + 'app/money?new=import'); await page.waitForTimeout(1200);
  for (const t of await englishLeftovers(page, dict)) leftovers.set(t, (leftovers.get(t) ?? '') + ' import-modal');
  await page.goto(B + 'app'); await page.waitForTimeout(1200);
  await page.keyboard.press('Control+k'); await page.waitForTimeout(300);
  for (const t of await englishLeftovers(page, dict)) leftovers.set(t, (leftovers.get(t) ?? '') + ' palette');
  await page.keyboard.press('Escape');

  await step(`${lang}: no untranslated UI text on any page`, async () => {
    if (leftovers.size) throw new Error([...leftovers].map(([t, where]) => `"${t}" @${where}`).join(' | '));
  });
  await step(`${lang}: no page errors`, async () => { if (errors.length) throw new Error(errors.join(' | ')); });
  await step(`${lang}: <html lang/dir>`, async () => {
    const [l, d] = await page.evaluate(() => [document.documentElement.lang, document.documentElement.dir]);
    if (l !== lang || d !== (lang === 'ar' ? 'rtl' : 'ltr')) throw new Error(`${l} ${d}`);
  });
  await page.goto(B + 'app'); await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SP}/shots4/dashboard-${lang}.png` });
  if (lang === 'ar') {
    await step('ar: sidebar is fully visible on the right', async () => {
      const box = await page.locator('aside').boundingBox();
      if (Math.round(box.x) !== 1440 - 256 || Math.round(box.x + box.width) !== 1440) throw new Error(JSON.stringify(box));
      await page.locator('aside').getByText('لوحة التحكم').waitFor({ state: 'visible', timeout: 2000 });
    });
    await step('en/ltr sidebar unchanged (left edge)', async () => {
      const box = await page.evaluate(() => { document.documentElement.dir = 'ltr'; return null; });
      const b = await page.locator('aside').boundingBox();
      await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
      if (Math.round(b.x) !== 0) throw new Error(JSON.stringify(b));
    });
    await step('ar: main content starts left of the sidebar', async () => {
      const box = await page.locator('main').boundingBox();
      if (!(box.x + box.width <= 1440 - 256 + 2)) throw new Error(JSON.stringify(box));
    });
    for (const p of ['app/products/inventory', 'app/supply-chain/reliability', 'app/settings']) {
      await page.goto(B + p); await page.waitForTimeout(1200);
      await page.screenshot({ path: `${SP}/shots4/${p.replace(/\//g, '_')}-ar.png` });
    }
    const m = await ctx.newPage();
    await m.setViewportSize({ width: 390, height: 844 });
    await m.goto(B + 'app'); await m.waitForTimeout(1200);
    await step('ar mobile: closed sidebar is fully off-screen and no horizontal scroll', async () => {
      const box = await m.locator('aside').boundingBox();
      const sw = await m.evaluate(() => document.documentElement.scrollWidth);
      if (box.x < 390 - 1) throw new Error('aside x=' + box.x);
      if (sw > 391) throw new Error('scrollWidth ' + sw);
    });
    await m.getByRole('button', { name: 'فتح القائمة' }).click(); await m.waitForTimeout(400);
    await step('ar mobile: menu opens from the right', async () => {
      const box = await m.locator('aside').boundingBox();
      if (Math.round(box.x + box.width) !== 390) throw new Error(JSON.stringify(box));
    });
    await m.screenshot({ path: `${SP}/shots4/mobile-menu-ar.png` });
  }
  await ctx.close();
}

// Switching language from the globe menu, persistence, browser detection.
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'en-US' });
  const page = await ctx.newPage();
  await page.goto(B);
  await step('English by default for an English browser', async () => { await page.getByText('Run your business.').waitFor({ timeout: 3000 }); });
  await page.getByRole('button', { name: /^Language:/ }).click();
  await page.getByRole('menuitemradio', { name: /Español/ }).click();
  await step('globe menu switches the landing page to Spanish', async () => { await page.getByText('Gestiona tu negocio.').waitFor({ timeout: 3000 }); });
  await page.reload();
  await step('choice is remembered after reload', async () => { await page.getByText('Gestiona tu negocio.').waitFor({ timeout: 3000 }); });
  await page.goto(B + 'app/settings'); await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Idioma', exact: true }).click();
  await page.getByRole('radio', { name: /Français/ }).click();
  await step('Settings → Language switches the whole app', async () => {
    await page.getByRole('heading', { name: 'Paramètres' }).waitFor({ timeout: 3000 });
    await page.locator('aside').getByText('Tableau de bord').waitFor({ timeout: 3000 });
  });
  await step('numbers follow the language (French percent spacing)', async () => {
    await page.goto(B + 'app/learn/funding'); await page.waitForTimeout(1200);
    const txt = await page.locator('main').innerText();
    if (!/\d[\u202f\u00a0]%/.test(txt)) throw new Error('no French-style percent found');
  });
  await ctx.close();
  const pt = await browser.newContext({ locale: 'pt-BR' });
  const p2 = await pt.newPage();
  await p2.goto(B);
  await step('Portuguese browser gets Portuguese automatically', async () => { await p2.getByText('Gerencie sua empresa.').waitFor({ timeout: 3000 }); });
  await pt.close();
  const qu = await browser.newContext({ locale: 'qu-PE' });
  const p3 = await qu.newPage();
  await p3.goto(B);
  await step('unsupported browser language falls back to English', async () => { await p3.getByText('Run your business.').waitFor({ timeout: 3000 }); });
  await qu.close();
}
await browser.close();
console.log(failed ? `${failed} FAILED` : 'ALL PASSED');
