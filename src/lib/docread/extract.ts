/**
 * Gets the text out of a document on the owner's device: plain text and CSV
 * files directly, PDFs with pdf.js, photos and scanned PDFs with tesseract.js.
 * Both engines are loaded only when a document is read, and the OCR engine
 * files are served by the site itself (copied into public/ocr at build time).
 */

export type ReadMethod = 'text' | 'pdf' | 'ocr';

export class UnsupportedFileError extends Error {}

/** Scanned PDFs are read page by page; only the first few, to keep it quick. */
const MAX_OCR_PAGES = 3;
/** Larger files are refused before anything is loaded. */
export const MAX_FILE_MB = 15;

const isText = (f: File) => f.type.startsWith('text/') || /\.(txt|csv|tsv)$/i.test(f.name);
const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
const isImage = (f: File) => f.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp|gif)$/i.test(f.name);

export const ACCEPTED_FILES = 'image/*,application/pdf,.pdf,.txt,.csv,.tsv';

async function ocr(images: (File | HTMLCanvasElement)[], onProgress: (p: number) => void): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const base = new URL('ocr/', document.baseURI).href;
  let page = 0;
  const worker = await createWorker('eng', 1, {
    workerPath: `${base}worker.min.js`,
    corePath: base,
    langPath: base.replace(/\/$/, ''),
    workerBlobURL: false,
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress((page + m.progress) / images.length);
    },
  });
  try {
    const out: string[] = [];
    for (; page < images.length; page++) out.push((await worker.recognize(images[page])).data.text);
    return out.join('\n');
  } finally {
    await worker.terminate();
  }
}

async function pdf(file: File, onProgress: (p: number) => void): Promise<{ text: string; method: ReadMethod }> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  try {
    const lines: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const content = await (await doc.getPage(i)).getTextContent();
      let line = '';
      for (const item of content.items) {
        if (!('str' in item)) continue;
        line += item.str;
        if (item.hasEOL) {
          lines.push(line);
          line = '';
        } else if (item.str && !line.endsWith(' ')) line += ' ';
      }
      if (line.trim()) lines.push(line);
      onProgress(i / doc.numPages / 2);
    }
    const text = lines.join('\n');
    if (text.replace(/\s/g, '').length > 20) return { text, method: 'pdf' };

    // No text layer: a scanned PDF. Draw the pages and read them like photos.
    const canvases: HTMLCanvasElement[] = [];
    for (let i = 1; i <= Math.min(doc.numPages, MAX_OCR_PAGES); i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise;
      canvases.push(canvas);
    }
    return { text: await ocr(canvases, (p) => onProgress(0.5 + p / 2)), method: 'ocr' };
  } finally {
    await doc.destroy();
  }
}

/** Reads a document's text. `onProgress` gets 0 to 1. */
export async function extractText(file: File, onProgress: (p: number) => void = () => {}): Promise<{ text: string; method: ReadMethod }> {
  if (file.size > MAX_FILE_MB * 1024 * 1024) throw new UnsupportedFileError('too-large');
  if (isText(file)) return { text: await file.text(), method: 'text' };
  if (isPdf(file)) return pdf(file, onProgress);
  if (isImage(file)) return { text: await ocr([file], onProgress), method: 'ocr' };
  throw new UnsupportedFileError('type');
}
