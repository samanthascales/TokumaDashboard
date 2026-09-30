// Lists every translatable string in src/ and checks each locale file has it.
// Also checks that each translation keeps the key's {placeholders}.
// Usage: node --experimental-strip-types scripts/i18n-keys.mjs [--json]   (exits 1 on a missing key or placeholder)
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = new URL('../src/', import.meta.url).pathname;
const files = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) {
      if (!p.includes('/i18n/locales')) walk(p);
    } else if (/\.tsx?$/.test(f)) files.push(p);
  }
})(SRC);

const CALL = /(?<![\w.$])(?:t|tk|tr|tNode)\(\s*('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")/g;
const keys = new Set();
for (const f of files) {
  // Skip comments so examples in doc comments aren't treated as UI text.
  const src = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const m of src.matchAll(CALL)) keys.add(eval(m[1]));
}
const sorted = [...keys].sort((a, b) => a.localeCompare(b));
if (process.argv.includes('--json')) {
  console.log(JSON.stringify(sorted, null, 1));
  process.exit(0);
}

const names = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
let failed = false;
for (const f of readdirSync(join(SRC, 'i18n/locales'))) {
  if (f === 'en.ts') continue;
  const dict = Object.values(await import(join(SRC, 'i18n/locales', f)))[0];
  const have = new Set(Object.keys(dict));
  for (const [k, v] of Object.entries(dict)) {
    for (const form of typeof v === 'string' ? [v] : Object.values(v)) {
      // A plural form may drop {count} (e.g. Arabic "one product"), but may not add or lose any other name.
      const want = names(k), got = names(form);
      if (got !== want && got !== want.split(',').filter((n) => n !== 'count').join(',')) {
        console.log(`${f}: placeholders differ for ${JSON.stringify(k)} → ${JSON.stringify(form)}`);
        failed = true;
      }
    }
  }
  const missing = sorted.filter((k) => !have.has(k));
  const unused = [...have].filter((k) => !keys.has(k));
  console.log(`${f}: ${have.size - unused.length}/${sorted.length} translated${missing.length ? `, ${missing.length} missing` : ''}${unused.length ? `, ${unused.length} unused` : ''}`);
  for (const k of missing.slice(0, 20)) console.log('  missing:', JSON.stringify(k));
  for (const k of unused.slice(0, 20)) console.log('  unused:', JSON.stringify(k));
  if (missing.length) failed = true;
}
process.exit(failed ? 1 : 0);
