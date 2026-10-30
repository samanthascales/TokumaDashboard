// Copies the text-recognition engine (tesseract.js) into public/ocr so the
// site serves it itself: documents are read on the owner's device and no
// outside service is contacted. Runs before `dev` and `build`; the copied
// files are generated, not committed (see .gitignore).
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'public', 'ocr');
const pkgDir = (name) => dirname(require.resolve(`${name}/package.json`));

const files = [
  [join(pkgDir('tesseract.js'), 'dist', 'worker.min.js'), 'worker.min.js'],
  // LSTM-only builds; the worker picks the one the browser supports.
  ...['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js'].map((f) => [join(pkgDir('tesseract.js-core'), f), f]),
  [join(pkgDir('@tesseract.js-data/eng'), '4.0.0_best_int', 'eng.traineddata.gz'), 'eng.traineddata.gz'],
];

mkdirSync(OUT, { recursive: true });
for (const [from, to] of files) {
  if (!existsSync(from)) {
    console.error(`copy-ocr: missing ${from} (run npm install)`);
    process.exit(1);
  }
  copyFileSync(from, join(OUT, to));
}
