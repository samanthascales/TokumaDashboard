import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import clsx from 'clsx';
import { AlertTriangle, Info, Plus, Recycle, Share2, Trash2 } from 'lucide-react';
import { useStore } from '../store/AppStore';
import { useChartColors } from '../lib/hooks';
import { fmtCompactMoney, fmtDate, fmtInt, fmtMoney, fmtMonth, fmtNum, fmtPct, startOfToday, toISO } from '../lib/format';
import { lastNDays, totalsFor, type Window } from '../lib/metrics';
import { avgFixedCosts, avgProfitPerItem, breakEvenUnits, cashFlow, cashRunway, profitAndLoss, type Line as PnLLine } from '../lib/accounting';
import { tk, useLang, useT } from '../i18n';
import { Card, CardHeader, Field, Modal, PageHeader, Segmented, Tabs, Term } from '../components/ui';
import { LegendItem, TooltipBox } from '../components/charts/ChartTooltip';
import type { Asset, Liability } from '../types';

type Tab = 'pnl' | 'balance' | 'cash' | 'breakeven';
const TABS: Tab[] = ['pnl', 'balance', 'cash', 'breakeven'];

/** A short "what is this?" box at the top of each report. */
function Intro({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-5 flex gap-3 rounded-xl border border-sky-200/70 bg-sky-50/70 p-4 text-sm text-sky-900 dark:border-sky-500/20 dark:bg-sky-500/[0.06] dark:text-sky-100">
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-semibold">{title}</p>
        <div className="mt-1 space-y-1 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

/** One line of a statement: a label (with an optional explanation) and an amount. */
function Row({ label, explain, amount, strong, tone, indent }: { label: string; explain?: ReactNode; amount: number; strong?: boolean; tone?: 'good' | 'bad'; indent?: boolean }) {
  return (
    <div className={clsx('flex items-center justify-between gap-4 py-2.5', strong ? 'border-t border-gray-200 font-semibold dark:border-white/10' : 'border-t border-gray-100 dark:border-white/5', indent && 'ps-4')}>
      <span className="min-w-0">{explain ? <Term label={label}>{explain}</Term> : label}</span>
      <span className={clsx('shrink-0 tabular-nums', tone === 'good' && 'text-brand-700 dark:text-brand-400', tone === 'bad' && 'text-red-600 dark:text-red-400')}>{fmtMoney(amount)}</span>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Profit & loss                                                     */
/* ---------------------------------------------------------------- */

type Period = '30d' | 'month' | 'lastMonth' | 'year';

function periodWindow(p: Period, today = startOfToday()): Window {
  if (p === '30d') return lastNDays(30, 0, today);
  if (p === 'month') return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: today };
  if (p === 'lastMonth') return { from: new Date(today.getFullYear(), today.getMonth() - 1, 1), to: new Date(today.getFullYear(), today.getMonth(), 0) };
  return { from: new Date(today.getFullYear(), 0, 1), to: today };
}

function ProfitLoss() {
  const t = useT();
  const { transactions } = useStore();
  const [period, setPeriod] = useState<Period>('30d');
  const w = periodWindow(period);
  const pnl = useMemo(() => profitAndLoss(transactions, w), [transactions, period]); // eslint-disable-line react-hooks/exhaustive-deps
  const kept = pnl.incomeTotal > 0 ? pnl.profit / pnl.incomeTotal : null;
  const lines = (ls: PnLLine[]) => ls.map((l) => <Row key={l.category} label={t(l.category)} amount={l.amount} indent />);

  return (
    <>
      <Intro title={t('What is a profit & loss statement?')}>
        <p>{t('It answers one question: was the business profitable? It lists your revenue, then your expenses. Revenue minus expenses is your net profit, or a net loss if it is below zero.')}</p>
      </Intro>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={period}
          onChange={setPeriod}
          options={[
            { value: '30d', label: t('Last 30 days') },
            { value: 'month', label: t('This month') },
            { value: 'lastMonth', label: t('Last month') },
            { value: 'year', label: t('This year') },
          ]}
        />
        <span className="muted text-xs">
          {fmtDate(toISO(w.from))} – {fmtDate(toISO(w.to))}
        </span>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2" data-testid="pnl">
          <h3 className="card-title mb-1">
            <Term label={t('Revenue')}>{t('What customers paid you for products and services. Loans, investment and grants are listed separately below, because they are not revenue.')}</Term>
          </h3>
          {pnl.income.length ? lines(pnl.income) : <p className="muted py-2 text-sm">{t('No revenue in this period.')}</p>}
          <Row label={t('Total revenue')} amount={pnl.incomeTotal} strong tone="good" />

          <h3 className="card-title mb-1 mt-6">
            <Term label={t('Expenses')}>{t('Costs of running the business: materials, inventory, rent, wages, shipping, marketing and other costs.')}</Term>
          </h3>
          {pnl.expenses.length ? lines(pnl.expenses) : <p className="muted py-2 text-sm">{t('No expenses in this period.')}</p>}
          <Row label={t('Total expenses')} amount={pnl.expenseTotal} strong />

          <div className={clsx('mt-6 flex items-center justify-between gap-4 rounded-xl p-4', pnl.profit >= 0 ? 'bg-brand-50 dark:bg-brand-500/10' : 'bg-red-50 dark:bg-red-500/10')}>
            <span className="font-semibold">
              <Term label={pnl.profit >= 0 ? t('Net profit') : t('Net loss')}>{t('Total revenue minus total expenses. Above zero is a net profit; below zero is a net loss.')}</Term>
            </span>
            <span className={clsx('text-2xl font-bold tabular-nums', pnl.profit >= 0 ? 'text-brand-700 dark:text-brand-300' : 'text-red-600 dark:text-red-400')} data-testid="pnl-profit">
              {fmtMoney(pnl.profit)}
            </span>
          </div>

          {pnl.financing.length > 0 && (
            <div className="mt-6">
              <h3 className="card-title mb-1">
                <Term label={t('Financing (not revenue)')}>{t('Loans must be paid back and investment belongs to your investors, so they are not revenue. Grants are listed here too, so a one-time grant does not make a normal month look better than it was.')}</Term>
              </h3>
              {lines(pnl.financing)}
            </div>
          )}
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <p className="muted text-sm">
              <Term label={t('Profit margin')}>{t('The share of every sale you keep as profit. A higher margin means more of each dollar stays in your business.')}</Term>
            </p>
            <p className="num mt-1 text-3xl">{kept === null ? '—' : fmtPct(kept * 100, 0)}</p>
            <p className="muted mt-1 text-sm">
              {kept === null ? t('Appears once you have revenue.') : kept >= 0 ? t('For every $1 of revenue, you kept {amount} as profit.', { amount: `${Math.round(kept * 100)}¢` }) : t('For every $1 of revenue, you lost {amount}.', { amount: `${Math.round(-kept * 100)}¢` })}
            </p>
          </Card>
          <Card className="p-5">
            <p className="muted flex items-center gap-1.5 text-sm">
              <Recycle className="h-4 w-4 text-brand-600 dark:text-brand-400" />
              <Term label={t('Circular revenue')}>
                <p>{t('Revenue from activities that keep products in use: repairs, resale or second-hand sales, rental, and take-back or refurbishing.')}</p>
                <p>{t('It shows that being circular can also earn money, and it counts toward your circularity score.')}</p>
              </Term>
            </p>
            <p className="num mt-1 text-3xl">{fmtMoney(pnl.circularIncome)}</p>
            <p className="muted mt-1 text-sm">
              {pnl.circularIncomeShare === null ? t('Appears once you have revenue.') : t('{pct} of your revenue.', { pct: fmtPct(pnl.circularIncomeShare, 0) })}
            </p>
            {pnl.circularIncome === 0 && <p className="muted mt-2 text-xs">{t('Tip: record repairs, resale, rental or take-back income under its own category to count it here.')}</p>}
          </Card>
        </div>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- */
/* Balance sheet                                                     */
/* ---------------------------------------------------------------- */

const ASSET_KINDS: Asset['kind'][] = [tk('Equipment'), tk('Vehicle'), tk('Property'), tk('Other')] as Asset['kind'][];
const LIABILITY_KINDS: Liability['kind'][] = [tk('Loan'), tk('Unpaid bill'), tk('Credit card'), tk('Other')] as Liability['kind'][];

function AddEntryModal({ kind, onClose }: { kind: 'asset' | 'liability' | null; onClose: () => void }) {
  const t = useT();
  const { addAsset, addLiability } = useStore();
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [amount, setAmount] = useState('');
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (kind) {
      setName('');
      setAmount('');
      setTouched(false);
      setType(kind === 'asset' ? 'Equipment' : 'Loan');
    }
  }, [kind]);
  const n = +amount;
  const err = !name.trim() ? t('Give it a name') : !(n > 0) ? t('Amount must be greater than 0') : null;
  const save = () => {
    setTouched(true);
    if (err) return;
    if (kind === 'asset') addAsset({ name: name.trim(), kind: type as Asset['kind'], value: n });
    else addLiability({ name: name.trim(), kind: type as Liability['kind'], amount: n });
    onClose();
  };
  return (
    <Modal
      open={!!kind}
      onClose={onClose}
      title={kind === 'asset' ? t('Add an asset') : t('Add a liability')}
      sub={kind === 'asset' ? t('For example a sewing machine, a van or a computer. Cash and inventory are added for you.') : t('For example a bank loan, a bill you have not paid yet, or a credit card balance.')}
      size="sm"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            {t('Cancel')}
          </button>
          <button className="btn-primary" onClick={save}>
            {t('Add')}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={t('Name')} error={touched && !name.trim() ? t('Give it a name') : null}>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === 'asset' ? t('Sewing machine') : t('Bank loan')} />
        </Field>
        <Field label={t('Type')}>
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            {(kind === 'asset' ? ASSET_KINDS : LIABILITY_KINDS).map((k) => (
              <option key={k} value={k}>
                {t(k)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={kind === 'asset' ? t('Current value ($)') : t('Amount owed ($)')} error={touched && !(n > 0) ? t('Amount must be greater than 0') : null}>
          <input type="number" min={0} step="0.01" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function StartingCashModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const { openingCash, setOpeningCash } = useStore();
  const [v, setV] = useState('');
  useEffect(() => {
    if (open) setV(openingCash === null ? '' : String(openingCash));
  }, [open, openingCash]);
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={t('Opening cash balance')}
      sub={t('The cash the business had (in the bank and on hand) before you started recording transactions in Tokuma.')}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            {t('Cancel')}
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              setOpeningCash(v === '' ? null : +v);
              onClose();
            }}
          >
            {t('Save')}
          </button>
        </>
      }
    >
      <Field label={t('Opening cash balance ($)')}>
        <input type="number" step="0.01" className="input" value={v} onChange={(e) => setV(e.target.value)} />
      </Field>
    </Modal>
  );
}

function BalanceSheetView() {
  const t = useT();
  const { balance, openingCash, removeAsset, removeLiability } = useStore();
  const [adding, setAdding] = useState<'asset' | 'liability' | null>(null);
  const [cashOpen, setCashOpen] = useState(false);
  const b = balance;
  return (
    <>
      <Intro title={t('What is a balance sheet?')}>
        <p>{t('A snapshot of your business on one day: its assets (what it owns), liabilities (what it owes) and owner’s equity (what is left). Banks and investors often ask for one.')}</p>
        <p>{t('Assets − liabilities = owner’s equity.')}</p>
      </Intro>
      {openingCash === null && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          <span className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {t('Cash starts from $0 because no opening cash balance has been entered. Add it for an accurate balance sheet.')}
          </span>
          <button className="btn-secondary btn-sm" onClick={() => setCashOpen(true)}>
            {t('Add opening balance')}
          </button>
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5" data-testid="assets">
          <div className="mb-1 flex items-center justify-between gap-3">
            <h3 className="card-title">
              <Term label={t('Assets')}>{t('What the business owns: cash, inventory you can sell, and equipment such as machines or a vehicle.')}</Term>
            </h3>
            <button className="btn-ghost btn-sm" onClick={() => setAdding('asset')}>
              <Plus className="h-3.5 w-3.5" /> {t('Add')}
            </button>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-gray-100 py-2.5 dark:border-white/5">
            <span>
              <Term label={t('Cash')}>
                <p>{t('Opening cash balance, plus all cash inflows, minus all cash outflows recorded in Tokuma.')}</p>
              </Term>
              <button className="ms-2 text-xs font-medium text-brand-700 hover:underline dark:text-brand-300" onClick={() => setCashOpen(true)}>
                {t('Edit opening balance')}
              </button>
            </span>
            <span className={clsx('tabular-nums', b.cash < 0 && 'text-red-600 dark:text-red-400')}>{fmtMoney(b.cash)}</span>
          </div>
          <Row label={t('Inventory')} explain={t('Products on hand, valued at unit cost.')} amount={b.stockValue} />
          {b.otherAssets.map((a) => (
            <div key={a.id} className="group flex items-center justify-between gap-4 border-t border-gray-100 py-2.5 dark:border-white/5">
              <span className="min-w-0 truncate">
                {a.name} <span className="muted text-xs">· {t(a.kind)}</span>
              </span>
              <span className="flex items-center gap-2 tabular-nums">
                {fmtMoney(a.value)}
                <button className="icon-btn h-7 w-7" onClick={() => removeAsset(a.id)} aria-label={t('Remove {name}', { name: a.name })}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </span>
            </div>
          ))}
          <Row label={t('Total assets')} amount={b.assetsTotal} strong tone="good" />
        </Card>

        <Card className="p-5" data-testid="liabilities">
          <div className="mb-1 flex items-center justify-between gap-3">
            <h3 className="card-title">
              <Term label={t('Liabilities')}>{t('What the business owes: loans, unpaid bills and credit card balances.')}</Term>
            </h3>
            <button className="btn-ghost btn-sm" onClick={() => setAdding('liability')}>
              <Plus className="h-3.5 w-3.5" /> {t('Add')}
            </button>
          </div>
          {b.liabilities.length === 0 && <p className="muted border-t border-gray-100 py-3 text-sm dark:border-white/5">{t('Nothing added. If you have a loan or unpaid bills, add them here.')}</p>}
          {b.liabilities.map((l) => (
            <div key={l.id} className="group flex items-center justify-between gap-4 border-t border-gray-100 py-2.5 dark:border-white/5">
              <span className="min-w-0 truncate">
                {l.name} <span className="muted text-xs">· {t(l.kind)}</span>
              </span>
              <span className="flex items-center gap-2 tabular-nums">
                {fmtMoney(l.amount)}
                <button className="icon-btn h-7 w-7" onClick={() => removeLiability(l.id)} aria-label={t('Remove {name}', { name: l.name })}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </span>
            </div>
          ))}
          <Row label={t('Total liabilities')} amount={b.liabilitiesTotal} strong />
          {b.liabilitiesTotal > 0 && b.cash < b.liabilitiesTotal && (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {t('Your liabilities are more than your cash balance. That is common with a loan, but keep an eye on when payments are due.')}
            </p>
          )}
        </Card>
      </div>

      <Card className="mt-5 p-5">
        <div className="flex flex-wrap items-center justify-center gap-3 text-center sm:gap-6">
          <div>
            <p className="muted text-xs">{t('Assets')}</p>
            <p className="num text-xl">{fmtMoney(b.assetsTotal)}</p>
          </div>
          <span className="text-2xl text-gray-300">−</span>
          <div>
            <p className="muted text-xs">{t('Liabilities')}</p>
            <p className="num text-xl">{fmtMoney(b.liabilitiesTotal)}</p>
          </div>
          <span className="text-2xl text-gray-300">=</span>
          <div>
            <p className="muted text-xs">
              <Term label={t('Owner’s equity')}>{t('Assets minus liabilities: what the business would be worth to the owner if it sold everything it owns and paid everything it owes.')}</Term>
            </p>
            <p className={clsx('text-2xl font-bold tabular-nums', b.equity >= 0 ? 'text-brand-700 dark:text-brand-300' : 'text-red-600 dark:text-red-400')} data-testid="equity">
              {fmtMoney(b.equity)}
            </p>
          </div>
        </div>
      </Card>
      <AddEntryModal kind={adding} onClose={() => setAdding(null)} />
      <StartingCashModal open={cashOpen} onClose={() => setCashOpen(false)} />
    </>
  );
}

/* ---------------------------------------------------------------- */
/* Cash flow                                                         */
/* ---------------------------------------------------------------- */

function CashFlowView() {
  const t = useT();
  const { lang } = useLang();
  const { transactions, openingCash, balance, theme } = useStore();
  const c = useChartColors(theme);
  const months = useMemo(() => cashFlow(transactions, openingCash, 6), [transactions, openingCash]);
  const runway = useMemo(() => cashRunway(transactions, balance.cash), [transactions, balance.cash]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- labels follow the language
  const data = useMemo(() => months.map((m) => ({ ...m, label: fmtMonth(m.month) })), [months, lang]);
  return (
    <>
      <Intro title={t('What is cash flow?')}>
        <p>{t('Cash flow shows when cash actually comes in and goes out. A business can be profitable and still run out of cash, for example after buying a lot of inventory, so it is worth watching both.')}</p>
      </Intro>
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="muted text-xs">
            <Term label={t('Cash balance')}>{t('Opening cash balance, plus all cash inflows, minus all cash outflows.')}</Term>
          </p>
          <p className={clsx('num mt-1 text-2xl', balance.cash < 0 && 'text-red-600 dark:text-red-400')}>{fmtMoney(balance.cash)}</p>
        </Card>
        <Card className="p-4">
          <p className="muted text-xs">
            <Term label={t('Average monthly expenses')}>{t('Total expenses over the last 3 months, divided by 3.')}</Term>
          </p>
          <p className="num mt-1 text-2xl">{runway ? fmtMoney(runway.monthlySpend) : '—'}</p>
        </Card>
        <Card className="p-4">
          <p className="muted text-xs">
            <Term label={t('Cash runway')}>{t('How many months your cash balance would cover your average monthly expenses if no revenue came in. Many advisers suggest at least 3 months.')}</Term>
          </p>
          <p className={clsx('num mt-1 text-2xl', runway && runway.months < 3 && 'text-amber-600 dark:text-amber-400')}>{runway ? t('{n} months', { n: fmtNum(runway.months) }) : '—'}</p>
        </Card>
      </div>
      <Card>
        <CardHeader title={t('Cash inflows and outflows by month')} sub={t('Last 6 months')} />
        <div className="flex flex-wrap gap-4 px-5 pt-3">
          <LegendItem color={c.money} label={t('Cash inflow')} />
          <LegendItem color={c.tertiary} label={t('Cash outflow')} />
          <LegendItem color={c.primary} label={t('Closing cash balance')} />
        </div>
        <div className="h-[260px] px-2 pb-2 pt-2" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={c.grid} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: c.axis }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: c.axis }} tickFormatter={(v) => fmtCompactMoney(v)} width={68} />
              <Tooltip
                cursor={{ fill: theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]!.payload as (typeof data)[number];
                  return (
                    <TooltipBox
                      title={d.label}
                      rows={[
                        { color: c.money, label: t('Cash inflow'), value: fmtMoney(d.cashIn) },
                        { color: c.tertiary, label: t('Cash outflow'), value: fmtMoney(d.cashOut) },
                        { color: c.primary, label: t('Closing cash balance'), value: fmtMoney(d.endCash) },
                      ]}
                    />
                  );
                }}
              />
              <Bar dataKey="cashIn" fill={c.money} radius={[4, 4, 0, 0]} maxBarSize={22} />
              <Bar dataKey="cashOut" fill={c.tertiary} radius={[4, 4, 0, 0]} maxBarSize={22} />
              <Line dataKey="endCash" stroke={c.primary} strokeWidth={2.5} dot={{ r: 3, fill: c.primary }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50/60 dark:bg-white/[0.02]">
              <tr>
                <th className="th">{t('Month')}</th>
                <th className="th text-end">{t('Cash inflow')}</th>
                <th className="th text-end">{t('Cash outflow')}</th>
                <th className="th text-end">
                  <Term label={t('Net cash flow')}>{t('Cash inflow minus cash outflow for the month. Negative means your cash balance went down.')}</Term>
                </th>
                <th className="th text-end">{t('Closing cash balance')}</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((m) => (
                <tr key={m.label} className="tr">
                  <td className="td">{m.label}</td>
                  <td className="td text-end tabular-nums">{fmtMoney(m.cashIn)}</td>
                  <td className="td text-end tabular-nums">{fmtMoney(m.cashOut)}</td>
                  <td className={clsx('td text-end font-semibold tabular-nums', m.net < 0 ? 'text-red-600 dark:text-red-400' : 'text-brand-700 dark:text-brand-400')}>{fmtMoney(m.net)}</td>
                  <td className="td text-end tabular-nums">{fmtMoney(m.endCash)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

/* ---------------------------------------------------------------- */
/* Break-even                                                        */
/* ---------------------------------------------------------------- */

function BreakEven() {
  const t = useT();
  const { transactions, products, ledger } = useStore();
  const units30 = useMemo(() => totalsFor(ledger, lastNDays(30)).units, [ledger]);
  const sold30 = Object.values(units30).reduce((s, n) => s + n, 0);
  const suggestedFixed = useMemo(() => Math.round(avgFixedCosts(transactions)), [transactions]);
  const [productId, setProductId] = useState('avg');
  const suggestedPerItem = useMemo(() => {
    if (productId === 'avg') return avgProfitPerItem(products, units30);
    const p = products.find((x) => x.id === productId);
    return p ? p.price - p.unitCost : null;
  }, [productId, products, units30]);
  const [fixed, setFixed] = useState<string>('');
  const [perItem, setPerItem] = useState<string>('');
  useEffect(() => setFixed(suggestedFixed ? String(suggestedFixed) : ''), [suggestedFixed]);
  useEffect(() => setPerItem(suggestedPerItem === null ? '' : String(+suggestedPerItem.toFixed(2))), [suggestedPerItem]);
  const f = +fixed || 0;
  const per = perItem === '' ? null : +perItem;
  const units = per === null ? null : breakEvenUnits(f, per);
  const soldForChoice = productId === 'avg' ? sold30 : units30[productId] ?? 0;
  const pct = units ? Math.min(100, (soldForChoice / units) * 100) : 0;

  return (
    <>
      <Intro title={t('What is break-even?')}>
        <p>{t('Break-even is the point where your revenue covers your fixed costs. Below it you make a loss; every sale above it adds to profit.')}</p>
      </Intro>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="space-y-4 p-5">
          <Field label={t('Fixed costs per month ($)')} hint={t('Your average rent, wages and marketing expenses over the last 3 months. Change it if you like.')}>
            <input type="number" min={0} className="input" value={fixed} onChange={(e) => setFixed(e.target.value)} data-testid="be-fixed" />
          </Field>
          <Field label={t('Which product?')}>
            <select className="input" value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="avg">{t('All products (average)')}</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('Profit per unit ($)')} hint={t('Price minus unit cost, from your products. Change it to test a new price.')}>
            <input type="number" step="0.01" className="input" value={perItem} onChange={(e) => setPerItem(e.target.value)} data-testid="be-per" />
          </Field>
          <p className="muted text-xs">
            <span>
              <Term label={t('Fixed costs')}>{t('Costs you pay every month however much you sell, like rent, wages and marketing. Materials are not included, because they are already part of each unit cost.')}</Term>
            </span>
          </p>
        </Card>
        <Card className="flex flex-col justify-center p-6 text-center">
          {per !== null && per <= 0 ? (
            <div className="text-amber-800 dark:text-amber-200">
              <AlertTriangle className="mx-auto h-8 w-8" />
              <p className="mt-3 font-semibold">{t('Each item costs more than you sell it for')}</p>
              <p className="muted mt-1 text-sm">{t('Selling more will not help. Raise the price or lower the cost first.')}</p>
            </div>
          ) : units === null ? (
            <p className="muted text-sm">{t('Add products with a price and cost to work out your break-even point.')}</p>
          ) : (
            <>
              <p className="muted text-sm">{t('To cover your fixed costs, sell')}</p>
              <p className="mt-1 text-5xl font-bold tabular-nums text-brand-700 dark:text-brand-300" data-testid="be-units">
                {fmtInt(units)}
              </p>
              <p className="mt-1 font-medium">{t('items a month')}</p>
              <p className="muted mt-1 text-sm">{t('That is about {n} a day.', { n: fmtNum(units / 30) })}</p>
              <div className="mx-auto mt-5 w-full max-w-sm text-start">
                <div className="flex justify-between text-xs">
                  <span className="muted">{t('Sold in the last 30 days: {n}', { n: fmtInt(soldForChoice) })}</span>
                  <span className="font-semibold tabular-nums">{fmtPct(pct, 0)}</span>
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
                  <div className={clsx('h-full rounded-full transition-all duration-700', pct >= 100 ? 'bg-brand-600 dark:bg-brand-400' : 'bg-amber-400')} style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-2 text-sm">
                  {soldForChoice >= units ? t('You are above break-even. Every extra sale is profit.') : t('You need {n} more sales a month to break even.', { n: fmtInt(units - soldForChoice) })}
                </p>
              </div>
            </>
          )}
        </Card>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- */

export default function Reports() {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab') as Tab | null;
  const tab: Tab = raw && TABS.includes(raw) ? raw : 'pnl';
  const setTab = (v: Tab) => setParams(v === 'pnl' ? {} : { tab: v }, { replace: true });
  const today = startOfToday();
  return (
    <>
      <PageHeader
        title={t('Reports')}
        sub={t('The standard financial statements every business uses, explained simply. Updated from your transactions. As of {date}.', { date: fmtDate(toISO(today)) })}
        actions={
          <>
            <button className="btn-secondary no-print" onClick={() => window.print()}>
              {t('Print or save as PDF')}
            </button>
            <Link to="/app/share?type=lender" className="btn-primary no-print">
              <Share2 className="h-4 w-4" /> {t('Share with a lender')}
            </Link>
          </>
        }
      >
        <div className="mt-5 overflow-x-auto">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'pnl', label: t('Profit & loss') },
              { value: 'balance', label: t('Balance sheet') },
              { value: 'cash', label: t('Cash flow') },
              { value: 'breakeven', label: t('Break-even') },
            ]}
          />
        </div>
      </PageHeader>
      <div key={tab} className="print-area animate-page-in">
        {tab === 'pnl' && <ProfitLoss />}
        {tab === 'balance' && <BalanceSheetView />}
        {tab === 'cash' && <CashFlowView />}
        {tab === 'breakeven' && <BreakEven />}
      </div>
    </>
  );
}
