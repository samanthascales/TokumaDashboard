import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
// Screenshots go to tests/e2e/output (or TEST_OUT). The app must be running at BASE_URL (see tests/README.md).
const SP = process.env.TEST_OUT ?? new URL('./output', import.meta.url).pathname;
for (const d of ['', '/shots4']) mkdirSync(SP + d, { recursive: true });
const B = process.env.BASE_URL ?? 'http://localhost:4173/#/';
const browser = await chromium.launch();
const errors = [];
const step = async (name, fn) => { try { await fn(); console.log('OK  ', name); } catch (e) { console.log('FAIL', name, '—', e.message.split('\n')[0]); } };
const watch = (page) => {
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('CERT')) errors.push(m.text()); });
};
const seedWith = (ctx, state) =>
  ctx.addInitScript((s) => {
    if (!localStorage.getItem('seeded')) {
      localStorage.setItem('tokuma-state-v2', s);
      localStorage.setItem('seeded', '1');
    }
  }, JSON.stringify(state));

// Placeholder questions rotate the right answer A, B, C, D (src/data/education.ts): question i (0-based) → option i % 4.
const right = (i) => i % 4;
const wrong = (i) => (i + 1) % 4;
const base = { profile: { businessName: 'Loopy Goods', ownerName: 'Sam Test' } };

const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await seedWith(ctx, base);
const page = await ctx.newPage();
watch(page);

await step('program: six phases, diagnostic call to action, modules locked', async () => {
  await page.goto(B + 'app/learn'); await page.waitForTimeout(1200);
  const phases = await page.getByTestId('phase-stepper').locator('li').count();
  if (phases !== 6) throw new Error('phases ' + phases);
  await page.getByText('Start with the diagnostic').waitFor();
  for (const id of ['sustainability', 'operations', 'finance', 'impact']) if (!(await page.getByTestId('module-card-' + id).innerText()).includes('Locked')) throw new Error(id + ' not locked');
  await page.getByTestId('module-card-finance').click();
  await page.getByText('Take the diagnostic first').waitFor();
  await page.screenshot({ path: SP + '/shots4/learn-program-empty.png' });
});

await step('scores and matching never show a made-up number', async () => {
  await page.goto(B + 'app/learn'); await page.waitForTimeout(800);
  const s = await page.getByTestId('edu-scores').innerText();
  if ((s.match(/how the score is weighted has not been decided/g) ?? []).length !== 2) throw new Error('scores: ' + s);
  if (/\d/.test(s)) throw new Error('a number appears in scores: ' + s);
  const m = await page.getByTestId('matching').innerText();
  if (!m.includes('Locked') || !m.includes('The minimum scores have not been decided yet.')) throw new Error('matching: ' + m);
});

await step('diagnostic: 48 questions, 75-minute timer', async () => {
  await page.goto(B + 'app/learn/diagnostic'); await page.waitForTimeout(600);
  await page.getByRole('button', { name: 'Start the timer' }).click();
  const timer = await page.getByTestId('diag-timer').innerText();
  if (!/^(75:00|74:5\d)$/.test(timer.trim())) throw new Error('timer ' + timer);
  if ((await page.getByRole('button', { name: /^Go to question \d+$/ }).count()) !== 48) throw new Error('not 48 questions');
});

// Module 1: 12/12, module 2: exactly 9/12 (the pass mark), module 3: 8/12, module 4: unanswered.
const correctIn = [12, 9, 8, 0];
await step('diagnostic: answers survive a reload and the timer keeps running', async () => {
  for (let j = 0; j < 6; j++) {
    await page.getByRole('radio').nth(right(j)).click();
    await page.getByRole('button', { name: 'Next' }).click();
  }
  await page.reload(); await page.waitForTimeout(1200);
  await page.getByText('6 of 48 answered').waitFor();
  const timer = (await page.getByTestId('diag-timer').innerText()).trim();
  if (timer === '75:00') throw new Error('timer restarted');
});

await step('diagnostic: submit with unanswered questions asks first', async () => {
  for (let j = 6; j < 48; j++) {
    const mod = Math.floor(j / 12), i = j % 12;
    if (mod < 3) await page.getByRole('radio').nth(i < correctIn[mod] ? right(i) : wrong(i)).click();
    if (j < 47) await page.getByRole('button', { name: 'Next' }).click();
  }
  await page.locator('main').getByRole('button', { name: 'Submit diagnostic' }).first().click();
  const d = page.getByRole('dialog');
  await d.getByText('12 questions are unanswered. They will count as wrong.').waitFor();
  await d.getByRole('button', { name: 'Submit diagnostic' }).click();
});

await step('diagnostic: 9/12 or more marks a module pre-tested, below that assigns it', async () => {
  const r = page.getByTestId('diag-results');
  await r.waitFor();
  const rows = await r.locator('li').allInnerTexts();
  const want = [['12 of 12', 'Pre-tested'], ['9 of 12', 'Pre-tested'], ['8 of 12', 'Assigned'], ['0 of 12', 'Assigned']];
  want.forEach(([score, status], k) => { if (!rows[k].includes(score) || !rows[k].includes(status)) throw new Error(`row ${k}: ${rows[k]}`); });
  await page.screenshot({ path: SP + '/shots4/learn-diagnostic-results.png' });
});

await step('diagnostic can only be taken once', async () => {
  await page.goto(B + 'app/learn/diagnostic'); await page.waitForTimeout(600);
  await page.getByTestId('diag-results').waitFor();
  if (await page.getByRole('button', { name: 'Start the timer' }).count()) throw new Error('can restart');
});

await step('pre-tested module: skips to the deliverable; submitting it completes the module', async () => {
  await page.goto(B + 'app/learn/modules/sustainability'); await page.waitForTimeout(600);
  await page.getByText('so it is pre-tested', { exact: false }).waitFor();
  await page.getByTestId('checkpoint').getByText('Covered by the diagnostic: 12 of 12.').waitFor();
  const d = page.getByTestId('deliverable');
  if (!(await d.getByRole('button', { name: 'Submit deliverable' }).isDisabled())) throw new Error('empty statement can be submitted');
  await d.locator('textarea').fill('We make bags from reclaimed sailcloth and repair them for free.');
  await d.getByRole('button', { name: 'Submit deliverable' }).click();
  await page.getByText('Deliverable saved').waitFor();
  await page.locator('main').getByText('Complete', { exact: true }).first().waitFor();
});

await step('assigned module: checkpoint unlocks only after every lesson and its knowledge check', async () => {
  await page.goto(B + 'app/learn/modules/finance'); await page.waitForTimeout(600);
  const start = page.getByTestId('checkpoint').getByRole('button', { name: 'Start checkpoint' });
  if (!(await start.isDisabled())) throw new Error('checkpoint open before lessons');
  const lessons = page.getByTestId('lessons').getByRole('button', { name: 'Start' });
  const n = await lessons.count();
  if (n < 3 || n > 4) throw new Error('lesson count ' + n);
  for (let k = 0; k < n; k++) {
    await page.getByTestId('lessons').getByRole('button', { name: 'Start' }).first().click();
    const d = page.getByRole('dialog');
    const done = d.getByRole('button', { name: 'Mark lesson as done' });
    if (!(await done.isDisabled())) throw new Error('lesson can finish before the check');
    // Ungraded: a wrong answer still finishes the lesson, and shows the right one.
    await d.getByRole('radio').nth(wrong(0)).click();
    await d.getByText('Not quite. The right answer is A.').waitFor();
    await d.getByRole('radio').nth(4 + right(1)).click();
    await d.getByText('Correct', { exact: true }).waitFor();
    await done.click();
  }
  if (await start.isDisabled()) throw new Error('checkpoint still locked');
});

await step('assigned module: checkpoint result is recorded', async () => {
  await page.getByTestId('checkpoint').getByRole('button', { name: 'Start checkpoint' }).click();
  const d = page.getByRole('dialog');
  for (let q = 0; q < 12; q++) await d.getByRole('radio').nth(q * 4 + (q < 10 ? right(q) : wrong(q))).click();
  await d.getByRole('button', { name: 'Submit checkpoint' }).click();
  await page.getByTestId('checkpoint').getByText('Latest result: 10 of 12').waitFor();
});

await step('financial snapshot: margin is calculated from what was entered', async () => {
  const d = page.getByTestId('deliverable');
  await d.locator('label:has-text("Period") input').fill('March 2026');
  await d.locator('label:has-text("Revenue") input').fill('1000');
  await d.locator('label:has-text("Costs") input').fill('600');
  const m = await page.getByTestId('snapshot-margin').innerText();
  if (!m.includes('40') || !m.includes('$400')) throw new Error('margin ' + m);
  await d.getByRole('button', { name: 'Submit deliverable' }).click();
  // The toast from the previous deliverable may still be showing.
  await page.getByText('Deliverable saved').last().waitFor();
  await page.screenshot({ path: SP + '/shots4/learn-module-finance.png', fullPage: true });
});

await step('program: milestones and module cards follow progress', async () => {
  await page.goto(B + 'app/learn'); await page.waitForTimeout(800);
  if (!(await page.getByTestId('module-card-finance').innerText()).includes('Complete')) throw new Error('finance not complete');
  if (!(await page.getByTestId('module-card-operations').innerText()).includes('Pre-tested')) throw new Error('operations not pre-tested');
  if (!(await page.getByTestId('module-card-impact').innerText()).includes('Assigned')) throw new Error('impact not assigned');
  // diagnostic + (2 pre-tested × 2) + (2 assigned × 3) = 11 milestones; done: diagnostic, M1 ×2, M2 checkpoint, M3 ×3 = 7.
  await page.getByText('7 of 11 done').first().waitFor();
  await page.screenshot({ path: SP + '/shots4/learn-program-progress.png', fullPage: true });
});

await step('settings: reset learning progress starts the program over', async () => {
  await page.goto(B + 'app/settings?section=appearance'); await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Reset learning progress' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reset learning progress' }).click();
  await page.getByText('Learning progress cleared').waitFor();
  await page.goto(B + 'app/learn'); await page.waitForTimeout(800);
  await page.getByText('Start with the diagnostic').waitFor();
});
await ctx.close();

// Time runs out while away: the diagnostic submits itself on the next visit.
{
  const c2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const startedAt = new Date(Date.now() - 76 * 60_000).toISOString();
  await seedWith(c2, { ...base, education: { diagnostic: { startedAt, answers: { 'diag-sustainability-1': 0 }, submittedAt: null } } });
  const p = await c2.newPage();
  watch(p);
  await step('time out: diagnostic submits automatically with the answers given', async () => {
    await p.goto(B + 'app/learn/diagnostic'); await p.waitForTimeout(1500);
    await p.getByText('Time is up: your diagnostic was submitted').waitFor();
    const rows = await p.getByTestId('diag-results').locator('li').allInnerTexts();
    if (!rows[0].includes('1 of 12') || !rows[0].includes('Assigned')) throw new Error(rows[0]);
  });
  await c2.close();
}

// Mobile: the program page fits a phone.
{
  const c3 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await seedWith(c3, base);
  const p = await c3.newPage();
  watch(p);
  await step('mobile: program and diagnostic have no horizontal page scroll', async () => {
    for (const r of ['app/learn', 'app/learn/diagnostic', 'app/learn/modules/operations']) {
      await p.goto(B + r); await p.waitForTimeout(1200);
      const sw = await p.evaluate(() => document.documentElement.scrollWidth);
      if (sw > 391) throw new Error(`${r} scrollWidth ${sw}`);
    }
  });
  await c3.close();
}

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO RUNTIME ERRORS');
await browser.close();
