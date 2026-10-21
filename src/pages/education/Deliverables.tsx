import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import type { EduModule } from '../../data/education';
import type { Deliverable, WasteLogEntry } from '../../types';
import { fmtDate, fmtMoney, fmtPct, startOfToday, toISO } from '../../lib/format';
import { Field } from '../../components/ui';
import { useT } from '../../i18n';

const today = () => toISO(startOfToday());
/** '' → null; anything that isn't a finite number → NaN, so it can be flagged. */
const parseNum = (s: string) => (s.trim() === '' ? null : Number(s));
const numStr = (n: number | null) => (n === null ? '' : String(n));
const bad = (n: number | null) => n !== null && !Number.isFinite(n);

type Props<K extends Deliverable['kind']> = { value: Extract<Deliverable, { kind: K }> | null; onSave: (d: Deliverable) => void };

function SaveBar({ value, disabled, onSave }: { value: Deliverable | null; disabled: boolean; onSave: () => void }) {
  const t = useT();
  return (
    <div className="mt-4 flex items-center justify-end gap-3">
      {value && <span className="muted me-auto text-xs">{t('Submitted {date}', { date: fmtDate(value.date) })}</span>}
      <button className="btn-primary" disabled={disabled} onClick={onSave}>
        {value ? t('Save changes') : t('Submit deliverable')}
      </button>
    </div>
  );
}

function StatementForm({ value, onSave }: Props<'statement'>) {
  const t = useT();
  const [text, setText] = useState(value?.text ?? '');
  return (
    <>
      <Field label={t('Your sustainability statement')} hint={t('A few sentences in your own words: what your business does, how it affects the environment, and what you do about it.')}>
        <textarea className="input min-h-[140px]" value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
      <SaveBar value={value} disabled={!text.trim()} onSave={() => onSave({ kind: 'statement', text: text.trim(), date: today() })} />
    </>
  );
}

type Row = { date: string; material: string; inKg: string; outKg: string; fate: string };
const blankRow = (): Row => ({ date: today(), material: '', inKg: '', outKg: '', fate: '' });

function WasteLogForm({ value, onSave }: Props<'wasteLog'>) {
  const t = useT();
  const [rows, setRows] = useState<Row[]>(() =>
    value?.entries.length ? value.entries.map((e) => ({ date: e.date, material: e.material, inKg: numStr(e.inKg), outKg: numStr(e.outKg), fate: e.fate })) : [blankRow()],
  );
  const set = (i: number, k: keyof Row, v: string) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const entries: WasteLogEntry[] = rows
    .map((r) => ({ date: r.date, material: r.material.trim(), inKg: parseNum(r.inKg), outKg: parseNum(r.outKg), fate: r.fate.trim() }))
    .filter((e) => e.material && (e.inKg !== null || e.outKg !== null));
  const invalid = rows.some((r) => bad(parseNum(r.inKg)) || bad(parseNum(r.outKg)) || (r.inKg !== '' && Number(r.inKg) < 0) || (r.outKg !== '' && Number(r.outKg) < 0));
  return (
    <>
      <p className="muted mb-3 text-sm">{t('One row per material. Write what came in and what left as waste or by-product, in kilograms, and what happened to it.')}</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="muted text-start text-xs">
              <th className="pb-2 pe-2 text-start font-medium">{t('Date')}</th>
              <th className="pb-2 pe-2 text-start font-medium">{t('Material')}</th>
              <th className="pb-2 pe-2 text-start font-medium">{t('In (kg)')}</th>
              <th className="pb-2 pe-2 text-start font-medium">{t('Out (kg)')}</th>
              <th className="pb-2 pe-2 text-start font-medium">{t('What happened to it')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="pb-2 pe-2">
                  <input type="date" className="input" value={r.date} onChange={(e) => set(i, 'date', e.target.value)} aria-label={t('Date')} />
                </td>
                <td className="pb-2 pe-2">
                  <input className="input" value={r.material} onChange={(e) => set(i, 'material', e.target.value)} aria-label={t('Material')} />
                </td>
                <td className="pb-2 pe-2">
                  <input type="number" min={0} step="any" className="input" value={r.inKg} onChange={(e) => set(i, 'inKg', e.target.value)} aria-label={t('In (kg)')} />
                </td>
                <td className="pb-2 pe-2">
                  <input type="number" min={0} step="any" className="input" value={r.outKg} onChange={(e) => set(i, 'outKg', e.target.value)} aria-label={t('Out (kg)')} />
                </td>
                <td className="pb-2 pe-2">
                  <input className="input" value={r.fate} onChange={(e) => set(i, 'fate', e.target.value)} aria-label={t('What happened to it')} />
                </td>
                <td className="pb-2">
                  <button className="icon-btn h-8 w-8" disabled={rows.length === 1} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} aria-label={t('Remove')}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn-ghost mt-1" onClick={() => setRows((rs) => [...rs, blankRow()])}>
        <Plus className="h-4 w-4" /> {t('Add row')}
      </button>
      {invalid && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{t('Weights must be numbers of 0 or more.')}</p>}
      <SaveBar value={value} disabled={invalid || entries.length === 0} onSave={() => onSave({ kind: 'wasteLog', entries, date: today() })} />
    </>
  );
}

function FinancialSnapshotForm({ value, onSave }: Props<'financialSnapshot'>) {
  const t = useT();
  const { pnl30, transactions } = useStore();
  const [period, setPeriod] = useState(value?.period ?? '');
  const [revenue, setRevenue] = useState(numStr(value?.revenue ?? null));
  const [costs, setCosts] = useState(numStr(value?.costs ?? null));
  const r = parseNum(revenue);
  const c = parseNum(costs);
  const invalid = bad(r) || bad(c) || (r !== null && r < 0) || (c !== null && c < 0);
  const margin = !invalid && r !== null && c !== null && r > 0 ? ((r - c) / r) * 100 : null;
  return (
    <>
      {transactions.length > 0 && (
        <button
          className="btn-secondary mb-4"
          onClick={() => {
            setPeriod(t('Last 30 days'));
            setRevenue(String(Math.round(pnl30.incomeTotal * 100) / 100));
            setCosts(String(Math.round(pnl30.expenseTotal * 100) / 100));
          }}
        >
          {t('Fill in from my last 30 days in Tokuma')}
        </button>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t('Period')} hint={t('For example: March 2026')}>
          <input className="input" value={period} onChange={(e) => setPeriod(e.target.value)} />
        </Field>
        <Field label={t('Revenue')} error={bad(r) || (r !== null && r < 0) ? t('Enter an amount of 0 or more') : null}>
          <input type="number" min={0} step="any" className="input" value={revenue} onChange={(e) => setRevenue(e.target.value)} />
        </Field>
        <Field label={t('Costs')} error={bad(c) || (c !== null && c < 0) ? t('Enter an amount of 0 or more') : null}>
          <input type="number" min={0} step="any" className="input" value={costs} onChange={(e) => setCosts(e.target.value)} />
        </Field>
      </div>
      <div className="mt-4 rounded-xl bg-gray-50 p-4 text-sm dark:bg-white/[0.03]" data-testid="snapshot-margin">
        <span className="muted">{t('Margin')}: </span>
        <span className="font-semibold">{margin === null ? '—' : `${fmtPct(margin)} · ${fmtMoney(r! - c!)}`}</span>
      </div>
      <SaveBar
        value={value}
        disabled={invalid || r === null || c === null || !period.trim()}
        onSave={() => onSave({ kind: 'financialSnapshot', period: period.trim(), revenue: r, costs: c, date: today() })}
      />
    </>
  );
}

function KpiForm({ value, onSave }: Props<'kpi'>) {
  const t = useT();
  const [name, setName] = useState(value?.name ?? '');
  const [unit, setUnit] = useState(value?.unit ?? '');
  const [baseline, setBaseline] = useState(numStr(value?.baseline ?? null));
  const [target, setTarget] = useState(numStr(value?.target ?? null));
  const b = parseNum(baseline);
  const g = parseNum(target);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('What you will measure')} hint={t('For example: kilograms of fabric reused each month')}>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t('Unit')} hint={t('For example: kg, %, litres')}>
          <input className="input" value={unit} onChange={(e) => setUnit(e.target.value)} />
        </Field>
        <Field label={t('Where you are now (optional)')} error={bad(b) ? t('Enter a number') : null}>
          <input type="number" step="any" className="input" value={baseline} onChange={(e) => setBaseline(e.target.value)} />
        </Field>
        <Field label={t('Your target (optional)')} error={bad(g) ? t('Enter a number') : null}>
          <input type="number" step="any" className="input" value={target} onChange={(e) => setTarget(e.target.value)} />
        </Field>
      </div>
      <SaveBar
        value={value}
        disabled={!name.trim() || bad(b) || bad(g)}
        onSave={() => onSave({ kind: 'kpi', name: name.trim(), unit: unit.trim(), baseline: b, target: g, date: today() })}
      />
    </>
  );
}

/** The deliverable form for a module, entered in the platform (Phase 3). */
export function DeliverableForm({ module }: { module: EduModule }) {
  const { education, saveDeliverable } = useStore();
  const value = education.modules[module.id].deliverable;
  const onSave = (d: Deliverable) => saveDeliverable(module.id, d);
  // A saved deliverable of another kind (if a module's deliverable ever changes) is ignored.
  const mine = value?.kind === module.deliverable.kind ? value : null;
  switch (module.deliverable.kind) {
    case 'statement':
      return <StatementForm value={mine as Props<'statement'>['value']} onSave={onSave} />;
    case 'wasteLog':
      return <WasteLogForm value={mine as Props<'wasteLog'>['value']} onSave={onSave} />;
    case 'financialSnapshot':
      return <FinancialSnapshotForm value={mine as Props<'financialSnapshot'>['value']} onSave={onSave} />;
    case 'kpi':
      return <KpiForm value={mine as Props<'kpi'>['value']} onSave={onSave} />;
  }
}
