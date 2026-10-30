import { useRef, useState } from 'react';
import { Camera, Loader2, ShieldCheck, Upload, X } from 'lucide-react';
import { Badge, Field, Term, clsx } from '../../components/ui';
import { ACCEPTED_FILES, MAX_FILE_MB, UnsupportedFileError, documentReader, type Confidence, type MaterialSuggestion, type ReadResult } from '../../lib/docread';
import type { MaterialClass } from '../../types';
import { useT } from '../../i18n';

export interface ReadMaterial {
  name: string;
  weightKg: number | null;
  type: MaterialClass | '';
}

interface Row extends MaterialSuggestion {
  include: boolean;
}

const CONFIDENCE_TONE: Record<Confidence, 'green' | 'amber' | 'gray'> = { high: 'green', medium: 'amber', low: 'amber' };
const num = (v: string) => (v.trim() === '' ? null : Number(v));
const round = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Optional helper in the product form: reads a supplier invoice, receipt or
 * spec sheet and suggests materials. Nothing is added until the owner has
 * checked the suggestions and pressed "Add".
 */
export function ReadDocumentPanel({ onAdd, onClose }: { onAdd: (materials: ReadMaterial[]) => void; onClose: () => void }) {
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState<{ name: string; progress: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReadResult | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [units, setUnits] = useState<number | null>(null);

  const read = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setResult(null);
    setBusy({ name: file.name, progress: 0 });
    try {
      const r = await documentReader.read(file, (progress) => setBusy({ name: file.name, progress }));
      setResult(r);
      setRows(r.suggestions.map((s) => ({ ...s, name: t(s.name), include: true })));
    } catch (e) {
      setError(
        e instanceof UnsupportedFileError
          ? e.message === 'too-large'
            ? t('This file is larger than {mb} MB. Try a smaller photo or PDF.', { mb: MAX_FILE_MB })
            : t('This type of file can’t be read. Use a photo, a PDF or a text file.')
          : t('Tokuma couldn’t read this document. Try a clearer photo, or add the materials by hand.'),
      );
    } finally {
      setBusy(null);
      for (const r of [fileRef, cameraRef]) if (r.current) r.current.value = '';
    }
  };

  const setRow = (id: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const chosen = rows.filter((r) => r.include);
  const perUnit = (kg: number | null) => (kg === null ? null : units && units > 1 ? round(kg / units) : kg);
  const add = () => {
    onAdd(chosen.map((r) => ({ name: r.name, weightKg: perUnit(r.weightKg), type: r.type })));
    onClose();
  };
  const confidenceLabel = (c: Confidence) => (c === 'medium' ? t('Check this') : t('Not sure'));

  return (
    <div className="mb-3 rounded-xl border border-gray-200 p-4 dark:border-white/10" data-testid="read-document">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            <Term label={t('Scan a document')}>
              <p>{t('Upload a supplier invoice, receipt or spec sheet. Tokuma looks for materials, weights and words like “recycled”, “reclaimed” or “FSC”, and suggests materials for this product.')}</p>
              <p>{t('You check every suggestion before it is added. This is optional: you can always type materials in yourself.')}</p>
            </Term>
          </p>
          <p className="muted mt-0.5 flex items-center gap-1 text-xs">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            {documentReader.onDevice ? t('Stays on your device. Nothing is uploaded.') : t('Your document is sent securely to be read and is not stored.')}
          </p>
        </div>
        <button className="icon-btn h-8 w-8 shrink-0" onClick={onClose} aria-label={t('Close')}>
          <X className="h-4 w-4" />
        </button>
      </div>

      {busy ? (
        <div className="mt-3 rounded-lg bg-gray-50 p-4 dark:bg-white/[0.03]" role="status">
          <p className="flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> {t('Reading {name}…', { name: busy.name })}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
            <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${Math.max(5, Math.round(busy.progress * 100))}%` }} />
          </div>
          <p className="muted mt-1.5 text-xs">{t('Photos can take up to a minute the first time.')}</p>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            read(e.dataTransfer.files?.[0]);
          }}
          className={clsx(
            'mt-3 rounded-lg border-2 border-dashed p-4 text-center transition',
            dragging ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'border-gray-200 dark:border-white/10',
          )}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" className="btn-primary justify-center" onClick={() => cameraRef.current?.click()}>
              <Camera className="h-4 w-4" /> {t('Take a photo')}
            </button>
            <button type="button" className="btn-secondary justify-center" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> {result ? t('Read another document') : t('Upload a file')}
            </button>
          </div>
          <p className="muted mt-2 text-xs">{t('Photo, PDF or text file, up to {mb} MB. You can also drag it here.', { mb: MAX_FILE_MB })}</p>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => read(e.target.files?.[0])} />
          <input id="read-document-file" ref={fileRef} type="file" accept={ACCEPTED_FILES} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => read(e.target.files?.[0])} />
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}

      {result && !busy && (
        <div className="mt-4">
          {rows.length === 0 ? (
            <p className="text-sm">{t('No materials found in this document. You can still add them by hand.')}</p>
          ) : (
            <>
              <p className="text-sm font-medium">{t('{count} materials found. Check them before adding.', { count: rows.length })}</p>
              <div className="mt-2 space-y-2">
                {rows.map((r) => (
                  <div key={r.id} className={clsx('rounded-lg border p-2.5', r.include ? 'border-gray-200 dark:border-white/10' : 'border-dashed border-gray-200 opacity-60 dark:border-white/10')}>
                    <div className="grid grid-cols-[20px_1fr_1fr] items-center gap-2 sm:grid-cols-[20px_1fr_90px_120px]">
                      <input type="checkbox" className="h-4 w-4" checked={r.include} onChange={(e) => setRow(r.id, { include: e.target.checked })} aria-label={t('Include {name}', { name: r.name })} />
                      <input className="input col-span-2 sm:col-span-1" value={r.name} onChange={(e) => setRow(r.id, { name: e.target.value })} aria-label={t('Material name')} />
                      <div className="relative col-start-2 sm:col-start-auto">
                        <input type="number" step="0.01" min={0} className="input pe-8" placeholder="0.00" value={r.weightKg ?? ''} onChange={(e) => setRow(r.id, { weightKg: num(e.target.value) })} aria-label={t('Weight (kg)')} />
                        <span className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">kg</span>
                      </div>
                      <select className="input" value={r.type} onChange={(e) => setRow(r.id, { type: e.target.value as MaterialClass | '' })} aria-label={t('Material type')}>
                        <option value="">{t('Type…')}</option>
                        <option value="Recycled">{t('Recycled')}</option>
                        <option value="Reused">{t('Reused')}</option>
                        <option value="Renewable">{t('Renewable')}</option>
                        <option value="Virgin">{t('Virgin')}</option>
                      </select>
                    </div>
                    {r.confidence !== 'high' && (
                      <div className="mt-1.5 flex items-center gap-2 ps-7">
                        <Badge tone={CONFIDENCE_TONE[r.confidence]}>{confidenceLabel(r.confidence)}</Badge>
                        <span className="muted min-w-0 truncate text-xs" title={r.line}>
                          “{r.line}”
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <Field label={t('How many products does this order make? (optional)')} hint={t('Weights are divided to give the weight of one product.')} className="mt-3 max-w-sm">
                <input type="number" min={1} step={1} className="input" placeholder={t('Optional')} value={units ?? ''} onChange={(e) => setUnits(num(e.target.value))} />
              </Field>
            </>
          )}
          <details className="mt-3 text-xs">
            <summary className="muted cursor-pointer">{t('See the text Tokuma read')}</summary>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-2 font-sans dark:bg-white/[0.03]">{result.text.trim() || '—'}</pre>
          </details>
          <div className="mt-3 flex justify-end gap-2">
            <button className="btn-secondary btn-sm" onClick={onClose}>
              {t('Cancel')}
            </button>
            <button className="btn-primary btn-sm" onClick={add} disabled={chosen.length === 0}>
              {t('Add {count} materials', { count: chosen.length })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
