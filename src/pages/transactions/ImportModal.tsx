import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { AlertTriangle, ArrowLeft, CheckCircle2, Copy, Download, FileSpreadsheet, Loader2, Upload, XCircle } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { IS_EMBEDDED } from '../../env';
import { fmtDate, fmtInt, fmtMoney2, startOfToday, toISO } from '../../lib/format';
import { useT } from '../../i18n';
import {
  FIELDS,
  TEMPLATE_CSV,
  buildTransactions,
  detectDateOrder,
  guessMapping,
  readSpreadsheet,
  type Cell,
  type DateOrder,
  type Mapping,
  type PreviewRow,
  type SheetTable,
} from '../../lib/importer';
import { Badge, Modal, Segmented, Toggle } from '../../components/ui';

type Step = 'choose' | 'map' | 'review';
const PREVIEW_LIMIT = 200;

const cellText = (v: Cell) => (v instanceof Date ? toISO(v) : v === null ? '' : String(v));

/** mode "sales": opened from the dashboard for a sales export — wording and defaults are about sales. */
export function ImportModal({ open, onClose, mode = 'transactions' }: { open: boolean; onClose: () => void; mode?: 'transactions' | 'sales' }) {
  const t = useT();
  const sales = mode === 'sales';
  const { products, customers, transactions, importTransactions } = useStore();
  const [step, setStep] = useState<Step>('choose');
  const [fileName, setFileName] = useState('');
  const [sheets, setSheets] = useState<SheetTable[]>([]);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [order, setOrder] = useState<DateOrder>('MDY');
  const [detected, setDetected] = useState<DateOrder | null>(null);
  const [createCustomers, setCreateCustomers] = useState(true);
  const [includeDupes, setIncludeDupes] = useState(false);
  const [filter, setFilter] = useState<'all' | 'problems'>('all');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setStep('choose');
    setFileName('');
    setSheets([]);
    setMapping(null);
    setError(null);
    setIncludeDupes(false);
    setFilter('all');
  }, [open]);

  const table = sheets[sheetIdx]?.rows ?? [];
  const header = table[0] ?? [];

  const selectSheet = (tables: SheetTable[], idx: number) => {
    const rows = tables[idx]?.rows ?? [];
    const m = guessMapping(rows[0] ?? [], { sales });
    setMapping(m);
    const d = m.date !== null ? detectDateOrder(rows.slice(1).map((r) => r[m.date!] ?? null)) : null;
    setDetected(d);
    setOrder(d ?? 'MDY');
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const tables = await readSpreadsheet(file);
      if (!tables.length || tables.every((x) => x.rows.length < 2)) throw new Error(t('That file has no rows under the header.'));
      const first = Math.max(0, tables.findIndex((x) => x.rows.length >= 2));
      setFileName(file.name);
      setSheets(tables);
      setSheetIdx(first);
      selectSheet(tables, first);
      setStep('map');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Couldn’t read that file.'));
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const missingRequired = !mapping
    ? []
    : [...(mapping.date === null ? [t('Date')] : []), ...(mapping.amount === null && mapping.unitPrice === null ? [t('Amount or Unit price')] : [])];

  const result = useMemo(() => {
    if (step !== 'review' || !mapping) return null;
    return buildTransactions(table, mapping, order, { products, customers, existing: transactions, createCustomers, today: toISO(startOfToday()), sales });
  }, [step, table, mapping, order, products, customers, transactions, createCustomers, sales]);

  const counts = useMemo(() => {
    const c = { ok: 0, warning: 0, error: 0, duplicate: 0 };
    result?.rows.forEach((r) => c[r.status]++);
    return c;
  }, [result]);
  const importable = result?.rows.filter((r) => r.tx && (r.status !== 'duplicate' || includeDupes)) ?? [];
  const shown = (result?.rows ?? []).filter((r) => filter === 'all' || r.status !== 'ok');

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([TEMPLATE_CSV], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tokuma-transactions-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const confirm = () => {
    if (!result || !importable.length) return;
    importTransactions(
      importable.map((r) => r.tx!),
      result.newCustomers,
      sales ? 'sale' : 'transaction',
    );
    onClose();
  };

  const colOptions = header.map((h, i) => ({ i, label: cellText(h).trim() || t('Column {n}', { n: i + 1 }) }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={
        <span className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-brand-600 dark:text-brand-400" /> {sales ? t('Import sales') : t('Import transactions')}
        </span>
      }
      sub={
        step === 'choose'
          ? sales
            ? t('From a sales export (Shopify, Square, Etsy, your POS or a spreadsheet). It’s read in your browser — nothing is uploaded.')
            : t('From a CSV or Excel (.xlsx) file. It’s read in your browser — nothing is uploaded.')
          : step === 'map'
            ? `${fileName} · ${t('match your columns to Tokuma’s fields')}`
            : `${fileName} · ${t('check the rows before they’re added')}`
      }
      footer={
        step === 'choose' ? (
          <button className="btn-secondary" onClick={onClose}>
            {t('Cancel')}
          </button>
        ) : step === 'map' ? (
          <>
            <button className="btn-ghost me-auto" onClick={() => setStep('choose')}>
              <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" /> {t('Choose another file')}
            </button>
            <button className="btn-primary" disabled={missingRequired.length > 0} onClick={() => setStep('review')}>
              {t('Review {count} rows', { count: Math.max(0, table.length - 1) })}
            </button>
          </>
        ) : (
          <>
            <button className="btn-ghost me-auto" onClick={() => setStep('map')}>
              <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" /> {t('Back to columns')}
            </button>
            <button className="btn-primary" disabled={!importable.length} onClick={confirm}>
              {sales ? t('Import {count} sales', { count: importable.length }) : t('Import {count} transactions', { count: importable.length })}
            </button>
          </>
        )
      }
    >
      {step === 'choose' && (
        <div className="space-y-5">
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              onFile(e.dataTransfer.files[0]);
            }}
            className={clsx(
              'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition',
              dragging ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/[0.02]',
            )}
          >
            {loading ? <Loader2 className="h-8 w-8 animate-spin text-brand-600" /> : <Upload className="h-8 w-8 text-gray-400" />}
            <p className="mt-3 text-sm font-semibold">{loading ? t('Reading file…') : t('Drop a file here, or click to choose')}</p>
            <p className="muted mt-1 text-xs">{t('.csv or .xlsx · one row per transaction · first row is the column names')}</p>
            <input id="import-file" ref={inputRef} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          {error && (
            <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </p>
          )}
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <div className="rounded-lg bg-gray-50 p-4 dark:bg-white/[0.03]">
              <p className="font-semibold">{t('Columns Tokuma understands')}</p>
              <p className="muted mt-1 text-xs leading-relaxed">
                {sales
                  ? t('One row per sale or line item. Needs a date and either a total or a unit price + quantity. Add product, quantity and customer columns to fill in circularity and customer insights. Column names don’t need to match — you’ll pick them next.')
                  : t('Date and Amount (or unit price + quantity) are required. Optional: type (in / out), category, product, quantity, customer, note. Your column names don’t need to match — you’ll pick them on the next step.')}
              </p>
              {IS_EMBEDDED ? (
                <p className="mt-3 flex items-center gap-2 rounded-md bg-white px-2 py-1.5 font-mono text-[11px] dark:bg-ink-850">
                  {TEMPLATE_CSV.trim()}
                  <button
                    className="ms-auto text-gray-400 hover:text-gray-700"
                    aria-label={t('Copy column names')}
                    onClick={() => navigator.clipboard?.writeText(TEMPLATE_CSV.trim()).catch(() => undefined)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </p>
              ) : (
                <button className="btn-secondary btn-sm mt-3" onClick={downloadTemplate}>
                  <Download className="h-3.5 w-3.5" /> {t('Download blank template')}
                </button>
              )}
            </div>
            <div className="rounded-lg bg-gray-50 p-4 dark:bg-white/[0.03]">
              <p className="font-semibold">{t('File in SharePoint, OneDrive or Google Sheets?')}</p>
              <p className="muted mt-1 text-xs leading-relaxed">
                {t('Download it first, then import the downloaded file. In SharePoint or OneDrive: open the file’s … menu → Download. In Google Sheets: File → Download → CSV or Microsoft Excel.')}
              </p>
            </div>
          </div>
        </div>
      )}

      {step === 'map' && mapping && (
        <div className="space-y-6">
          {sheets.length > 1 && (
            <label className="block">
              <span className="label">{t('Sheet')}</span>
              <select
                id="import-sheet"
                className="input w-auto"
                value={sheetIdx}
                onChange={(e) => {
                  setSheetIdx(+e.target.value);
                  selectSheet(sheets, +e.target.value);
                }}
              >
                {sheets.map((s, i) => (
                  <option key={s.name + i} value={i}>
                    {s.name} ({t('{count} rows', { count: Math.max(0, s.rows.length - 1) })})
                  </option>
                ))}
              </select>
            </label>
          )}

          <div>
            <p className="label">{t('Your file (first rows)')}</p>
            <div className="scrollbar-thin overflow-x-auto rounded-lg border border-gray-200 dark:border-white/10">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 dark:bg-white/[0.03]">
                  <tr>
                    {colOptions.map((c) => (
                      <th key={c.i} className="whitespace-nowrap px-3 py-2 text-start font-semibold">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.slice(1, 5).map((r, ri) => (
                    <tr key={ri} className="border-t border-gray-100 dark:border-white/5">
                      {colOptions.map((c) => (
                        <td key={c.i} className="max-w-[180px] truncate whitespace-nowrap px-3 py-1.5 text-gray-600 dark:text-gray-300">
                          {cellText(r[c.i] ?? null)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <label key={f.key} className="block">
                <span className="label">
                  {t(f.label)} {f.required && <span className="text-red-500">*</span>}
                  {(f.key === 'amount' || f.key === 'unitPrice') && (
                    <span className="font-normal text-gray-400"> · {t('this or {field} is required', { field: f.key === 'amount' ? t('Unit price') : t('Amount') })}</span>
                  )}
                </span>
                <select
                  id={`map-${f.key}`}
                  className={clsx('input', ((f.required && mapping[f.key] === null) || ((f.key === 'amount' || f.key === 'unitPrice') && mapping.amount === null && mapping.unitPrice === null)) && 'input-error')}
                  value={mapping[f.key] ?? ''}
                  onChange={(e) => {
                    const v = e.target.value === '' ? null : +e.target.value;
                    setMapping((m) => ({ ...m!, [f.key]: v }));
                    if (f.key === 'date' && v !== null) {
                      const d = detectDateOrder(table.slice(1).map((r) => r[v] ?? null));
                      setDetected(d);
                      if (d) setOrder(d);
                    }
                  }}
                >
                  <option value="">{f.required ? t('Choose a column…') : `— ${t('Not in my file')} —`}</option>
                  {colOptions.map((c) => (
                    <option key={c.i} value={c.i}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <span className="muted mt-1 block text-xs">{t(f.help)}</span>
              </label>
            ))}
          </div>

          <div className="grid gap-4 rounded-lg bg-gray-50 p-4 text-sm dark:bg-white/[0.03] sm:grid-cols-2">
            <div>
              <p className="label">{t('Date format')}</p>
              <Segmented
                value={order}
                onChange={setOrder}
                options={[
                  { value: 'MDY', label: t('MM/DD/YYYY') },
                  { value: 'DMY', label: t('DD/MM/YYYY') },
                  { value: 'YMD', label: t('YYYY-MM-DD') },
                ]}
              />
              <p className="muted mt-1.5 text-xs">{detected ? t('Detected from your dates.') : t('Your dates could be read either way — check this is right.')} {t('Excel date cells are read automatically.')}</p>
            </div>
            <div className="space-y-3">
              {mapping.type === null && (
                <p className="muted text-xs">{sales ? t('Every row is a sale. Negative amounts are recorded as refunds (money out).') : t('No type column: positive amounts are imported as money in, negative amounts as money out.')}</p>
              )}
              {mapping.customer !== null && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs">{t('Add customers that aren’t in Tokuma yet')}</span>
                  <Toggle checked={createCustomers} onChange={setCreateCustomers} label={t('Add new customers')} />
                </div>
              )}
            </div>
          </div>
          {missingRequired.length > 0 && <p className="text-sm text-red-600 dark:text-red-400">{t('Choose a column for {fields} to continue.', { fields: missingRequired.join(' + ') })}</p>}
        </div>
      )}

      {step === 'review' && result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: t('Ready'), n: counts.ok, cls: 'text-brand-700 dark:text-brand-400', icon: CheckCircle2 },
              { label: t('Ready, with notes'), n: counts.warning, cls: 'text-amber-600 dark:text-amber-400', icon: AlertTriangle },
              { label: t('Already imported'), n: counts.duplicate, cls: 'text-gray-500', icon: Copy },
              { label: t('Can’t import'), n: counts.error, cls: 'text-red-600 dark:text-red-400', icon: XCircle },
            ].map((c) => (
              <div key={c.label} className="rounded-lg border border-gray-200 p-3 dark:border-white/10">
                <p className={clsx('flex items-center gap-1.5 text-xs font-medium', c.cls)}>
                  <c.icon className="h-3.5 w-3.5" /> {c.label}
                </p>
                <p className="num mt-1 text-xl">{fmtInt(c.n)}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: t('All rows ({count})', { count: result.rows.length }) },
                { value: 'problems', label: t('Needs a look ({count})', { count: counts.warning + counts.error + counts.duplicate }) },
              ]}
            />
            {counts.duplicate > 0 && (
              <span className="flex items-center gap-2 text-xs">
                {t('Import rows that look already imported')}
                <Toggle checked={includeDupes} onChange={setIncludeDupes} label={t('Include duplicates')} />
              </span>
            )}
          </div>

          <div className="scrollbar-thin max-h-[46vh] overflow-auto rounded-lg border border-gray-200 dark:border-white/10">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 dark:bg-ink-850">
                <tr>
                  {['Row', 'Status', 'Date', 'Type', 'Category', 'Product', 'Qty', 'Customer', 'Amount'].map((h) => (
                    <th key={h} className={clsx('whitespace-nowrap px-3 py-2 font-semibold', h === 'Amount' ? 'text-end' : 'text-start')}>
                      {t(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.slice(0, PREVIEW_LIMIT).map((r) => (
                  <ReviewRow key={r.line} r={r} excluded={r.status === 'duplicate' && !includeDupes} />
                ))}
              </tbody>
            </table>
            {shown.length === 0 && <p className="muted p-6 text-center text-sm">{t('Nothing needs a look — every row is ready.')}</p>}
            {shown.length > PREVIEW_LIMIT && <p className="muted border-t border-gray-100 p-3 text-center text-xs dark:border-white/5">{t('Showing the first {n} of {total} rows. All ready rows will be imported.', { n: PREVIEW_LIMIT, total: fmtInt(shown.length) })}</p>}
          </div>
          <p className="muted text-xs">{t('Rows marked “Can’t import” are skipped — fix them in your file and import it again. Imports don’t change stock on hand; update stock on the Inventory page if needed.')}</p>
        </div>
      )}
    </Modal>
  );
}

function ReviewRow({ r, excluded }: { r: PreviewRow; excluded: boolean }) {
  const t = useT();
  const tone = r.status === 'ok' ? 'green' : r.status === 'warning' ? 'amber' : r.status === 'duplicate' ? 'gray' : 'red';
  const label = r.status === 'ok' || r.status === 'warning' ? t('Ready') : r.status === 'duplicate' ? (excluded ? t('Skipped') : t('Duplicate')) : t('Error');
  return (
    <>
      <tr className={clsx('border-t border-gray-100 dark:border-white/5', (r.status === 'error' || excluded) && 'opacity-60')}>
        <td className="px-3 py-1.5 tabular-nums text-gray-400">{r.line}</td>
        <td className="px-3 py-1.5">
          <Badge tone={tone}>{label}</Badge>
        </td>
        <td className="whitespace-nowrap px-3 py-1.5">{r.tx ? fmtDate(r.tx.date) : '—'}</td>
        <td className="px-3 py-1.5">{r.tx ? (r.tx.type === 'inflow' ? t('In') : t('Out')) : '—'}</td>
        <td className="max-w-[140px] truncate px-3 py-1.5">{r.tx ? t(r.tx.category) : '—'}</td>
        <td className="max-w-[140px] truncate px-3 py-1.5">{r.productName ?? '—'}</td>
        <td className="px-3 py-1.5 tabular-nums">{r.tx?.quantity ?? '—'}</td>
        <td className="max-w-[140px] truncate px-3 py-1.5">{r.customerName ?? '—'}</td>
        <td className="whitespace-nowrap px-3 py-1.5 text-end font-medium tabular-nums">{r.tx ? <span dir="ltr">{`${r.tx.type === 'inflow' ? '+' : '−'}${fmtMoney2(r.tx.amount)}`}</span> : '—'}</td>
      </tr>
      {r.messages.length > 0 && (
        <tr>
          <td />
          <td colSpan={8} className={clsx('px-3 pb-2 text-[11px]', r.status === 'error' ? 'text-red-600 dark:text-red-400' : 'text-gray-500')}>
            {r.messages.join(' · ')}
          </td>
        </tr>
      )}
    </>
  );
}
