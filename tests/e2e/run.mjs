// Builds the app, serves it, and runs every browser test suite in order.
// Usage: npm run test:e2e   (the accounts suite runs separately: see tests/README.md)
import { spawn, spawnSync } from 'node:child_process';

const ROOT = new URL('../../', import.meta.url).pathname;
const suites = ['fresh', 'inputs', 'import', 'sales-import', 'nav', 'reports', 'i18n', 'profile'];
const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}/#/`;

if (!process.argv.includes('--no-build')) {
  const b = spawnSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' });
  if (b.status) process.exit(b.status);
}
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
for (let i = 0; i < 40; i++) {
  try {
    if ((await fetch(`http://localhost:${PORT}/`)).ok) break;
  } catch {
    /* not up yet */
  }
  await new Promise((r) => setTimeout(r, 500));
}

const results = [];
for (const s of suites) {
  console.log(`\n=== ${s}`);
  const r = spawnSync('node', ['--experimental-strip-types', '--no-warnings', `tests/e2e/${s}.mjs`], {
    cwd: ROOT,
    env: { ...process.env, BASE_URL },
    encoding: 'utf8',
  });
  process.stdout.write(r.stdout + r.stderr);
  const failed = r.status !== 0 || /^FAIL/m.test(r.stdout);
  results.push([s, (r.stdout.match(/^OK/gm) ?? []).length, (r.stdout.match(/^FAIL/gm) ?? []).length, failed]);
}
server.kill();

console.log('\nSuite          Passed  Failed');
for (const [s, ok, fail] of results) console.log(`${s.padEnd(15)}${String(ok).padStart(6)}${String(fail).padStart(8)}`);
process.exit(results.some((r) => r[3]) ? 1 : 0);
