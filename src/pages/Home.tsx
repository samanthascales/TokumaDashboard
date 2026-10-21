import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import clsx from 'clsx';
import { ArrowRight, Leaf, Plus, Target, Upload, Wallet } from 'lucide-react';
import { useStore } from '../store/AppStore';
import { useChartColors, useSimulatedLoad } from '../lib/hooks';
import { fmtCompactMoney, fmtMoney, fmtMonth, fmtPct, startOfToday } from '../lib/format';
import { avgKnown, circularityFrom, totalsFor } from '../lib/metrics';
import { profitAndLoss } from '../lib/accounting';
import { circularityScore, LEVEL_FROM, type ScoreLevel } from '../lib/score';
import { levelName, levelTone, ScoreExplainer } from '../components/ScoreBits';
import { t, useLang, useT } from '../i18n';
import { Badge, Card, CardHeader, CardSkeleton, Field, Gauge, Modal, PageHeader, Term } from '../components/ui';
import { LegendItem, TooltipBox } from '../components/charts/ChartTooltip';
import { GettingStarted, InsightsFeed, LowStockBanner } from './dashboard/Widgets';
import { ImportModal } from './transactions/ImportModal';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? t('Good morning') : h < 18 ? t('Good afternoon') : t('Good evening');
}

/** A thin progress bar toward a goal. */
function GoalBar({ value, goal, label }: { value: number; goal: number; label: string }) {
  const pct = goal > 0 ? Math.max(0, Math.min(100, (value / goal) * 100)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="muted flex items-center gap-1">
          <Target className="h-3.5 w-3.5" /> {label}
        </span>
        <span className="font-semibold tabular-nums">{t('{pct} of goal', { pct: fmtPct(pct, 0) })}</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
        <div className={clsx('h-full rounded-full transition-all duration-700', pct >= 100 ? 'bg-brand-600 dark:bg-brand-400' : 'bg-amber-400')} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MoneyCard({ onGoals }: { onGoals: () => void }) {
  useT();
  const { pnl30, pnlPrev30, goals, transactions } = useStore();
  const has = transactions.length > 0;
  const p = pnl30.profit;
  const tone = !has ? 'gray' : p <= 0 ? 'red' : goals.monthlyProfit && p < goals.monthlyProfit ? 'amber' : 'green';
  const change = pnlPrev30.incomeTotal || pnlPrev30.expenseTotal ? p - pnlPrev30.profit : null;
  return (
    <Card className="flex h-full flex-col p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
            <Wallet className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-semibold">{t('How is my money?')}</h2>
            <p className="muted text-xs">{t('Last 30 days')}</p>
          </div>
        </div>
        {has && <Badge tone={tone} dot>{tone === 'green' ? t('Healthy') : tone === 'amber' ? t('Below goal') : t('Losing money')}</Badge>}
      </div>

      <p className="muted mt-5 text-sm">
        <Term label={t('Profit')}>
          <p>{t('Profit is the money left over after paying your costs: money in from sales and services, minus money out for things like materials, rent and wages.')}</p>
          <p>{t('Loans, investment and grants are not counted, because they are not money your business earned.')}</p>
        </Term>
      </p>
      <p className={clsx('mt-1 text-4xl font-bold tracking-tight tabular-nums', has && p < 0 && 'text-red-600 dark:text-red-400')} data-testid="home-profit">
        {has ? fmtMoney(p) : '—'}
      </p>
      <p className="mt-2 text-sm">
        {!has
          ? t('Record your sales and costs to see your profit.')
          : p >= 0
            ? t('You earned {amount} more than you spent.', { amount: fmtMoney(p) })
            : t('You spent {amount} more than you earned.', { amount: fmtMoney(-p) })}
        {change !== null && (
          <span className="muted">
            {' '}
            {change >= 0 ? t('That is {amount} better than the 30 days before.', { amount: fmtMoney(change) }) : t('That is {amount} worse than the 30 days before.', { amount: fmtMoney(-change) })}
          </span>
        )}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-gray-50 p-3 dark:bg-white/[0.03]">
          <p className="muted text-xs">
            <Term label={t('Money in')}>{t('Everything customers paid you: product sales, repairs, resale, rental and other income.')}</Term>
          </p>
          <p className="num mt-0.5 text-lg text-brand-700 dark:text-brand-400">{fmtMoney(pnl30.incomeTotal)}</p>
        </div>
        <div className="rounded-xl bg-gray-50 p-3 dark:bg-white/[0.03]">
          <p className="muted text-xs">
            <Term label={t('Money out')}>{t('Everything you paid for running the business: materials, stock, rent, wages, shipping, marketing and other costs.')}</Term>
          </p>
          <p className="num mt-0.5 text-lg">{fmtMoney(pnl30.expenseTotal)}</p>
        </div>
      </div>

      <div className="mt-auto pt-5">
        {goals.monthlyProfit ? (
          <GoalBar value={p} goal={goals.monthlyProfit} label={t('Goal: {amount} profit a month', { amount: fmtMoney(goals.monthlyProfit) })} />
        ) : (
          <button className="btn-ghost btn-sm -ms-2" onClick={onGoals}>
            <Target className="h-3.5 w-3.5" /> {t('Set a profit goal')}
          </button>
        )}
        <Link to="/app/reports" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
          {t('See your reports')} <ArrowRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
        </Link>
      </div>
    </Card>
  );
}

function ScoreCard({ onGoals }: { onGoals: () => void }) {
  useT();
  const { score, scorePrev, goals, circ30 } = useStore();
  const s = score.score;
  const change = s !== null && scorePrev.score !== null ? s - scorePrev.score : null;
  const levelText: Record<ScoreLevel, string> = {
    starter: t('Most of what you sell is made from new materials. Small changes can raise your score quickly.'),
    grower: t('You are on your way: a good part of your business is already circular.'),
    leader: t('Your business keeps most materials in use. Share this with your customers and lenders.'),
  };
  return (
    <Card className="flex h-full flex-col p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
            <Leaf className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-semibold">{t('How circular is my business?')}</h2>
            <p className="muted text-xs">{t('Last 30 days')}</p>
          </div>
        </div>
        {score.level && <Badge tone={levelTone(score.level)} dot>{levelName(score.level)}</Badge>}
      </div>

      <div className="mt-5 flex items-center gap-5">
        <Gauge value={s} size={112} stroke={10} label={t('of 100')} bands={[LEVEL_FROM.grower, LEVEL_FROM.leader]} />
        <div className="min-w-0">
          <p className="muted text-sm">
            <Term label={t('Circularity score')}>
              <ScoreExplainer />
            </Term>
          </p>
          <p className="mt-1 text-sm">{score.level ? levelText[score.level] : t('Record a sale of a product with its materials to get your first score.')}</p>
          {change !== null && (
            <p className="muted mt-1 text-xs">
              {Math.abs(change) < 1 ? t('Same as the 30 days before.') : change > 0 ? t('Up {n} points from the 30 days before.', { n: change }) : t('Down {n} points from the 30 days before.', { n: -change })}
            </p>
          )}
        </div>
      </div>

      {circ30.hasData && (
        <p className="mt-4 rounded-xl bg-gray-50 p-3 text-sm dark:bg-white/[0.03]">
          {t('{pct} of the materials in what you sold were recycled or reused.', { pct: fmtPct(circ30.rate, 0) })}
        </p>
      )}

      <div className="mt-auto pt-5">
        {goals.circularityScore ? (
          <GoalBar value={s ?? 0} goal={goals.circularityScore} label={t('Goal: a score of {n}', { n: goals.circularityScore })} />
        ) : (
          <button className="btn-ghost btn-sm -ms-2" onClick={onGoals}>
            <Target className="h-3.5 w-3.5" /> {t('Set a circularity goal')}
          </button>
        )}
        <Link to="/app/circularity" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
          {t('See how to raise your score')} <ArrowRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
        </Link>
      </div>
    </Card>
  );
}

/** Profit and circularity score month by month: the two bottom lines side by side. */
function TwoBottomLines() {
  useT();
  const { lang } = useLang();
  const { transactions, ledger, products, suppliers, theme } = useStore();
  const c = useChartColors(theme);
  const data = useMemo(() => {
    const today = startOfToday();
    const supplierAvg = avgKnown(suppliers.map((s) => s.sustainabilityRating));
    return Array.from({ length: 12 }, (_, i) => {
      const from = new Date(today.getFullYear(), today.getMonth() - (11 - i), 1);
      const end = new Date(from.getFullYear(), from.getMonth() + 1, 0);
      const w = { from, to: end > today ? today : end };
      const pnl = profitAndLoss(transactions, w);
      const circ = circularityFrom(products, totalsFor(ledger, w).units);
      const sc = circularityScore({ materials: circ.hasData ? circ.rate : null, income: pnl.circularIncomeShare, suppliers: supplierAvg }).score;
      return { label: fmtMonth(from), profit: Math.round(pnl.profit), score: sc, any: pnl.incomeTotal > 0 || pnl.expenseTotal > 0 };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- month labels follow the language
  }, [transactions, ledger, products, suppliers, lang]);
  const empty = !data.some((d) => d.any);
  return (
    <Card>
      <CardHeader
        title={
          <Term label={t('Money and circularity, month by month')}>
            <p>{t('Bars show your profit each month: blue when you made money, red when you lost money.')}</p>
            <p>{t('The line shows your circularity score. A strong business grows both at the same time.')}</p>
          </Term>
        }
        sub={t('Last 12 months')}
      />
      <div className="flex flex-wrap gap-4 px-5 pt-3">
        <LegendItem color={c.money} label={t('Profit')} />
        <LegendItem color={c.primary} label={t('Circularity score')} />
      </div>
      <div className="relative h-[280px] px-2 pb-3 pt-2" dir="ltr">
        {empty && <p className="muted absolute inset-0 z-10 flex items-center justify-center px-6 text-center text-sm">{t('Your profit and circularity score will appear here as you record sales and costs.')}</p>}
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ left: 0, right: 4, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={c.grid} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: c.axis }} minTickGap={8} />
            <YAxis yAxisId="m" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: c.axis }} tickFormatter={(v) => fmtCompactMoney(v)} width={68} />
            <YAxis yAxisId="s" orientation="right" domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: c.axis }} width={32} />
            <ReferenceLine yAxisId="m" y={0} stroke={c.neutral} />
            <Tooltip
              cursor={{ fill: theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]!.payload as (typeof data)[number];
                return (
                  <TooltipBox
                    title={d.label}
                    rows={[
                      { color: d.profit < 0 ? c.negative : c.money, label: t('Profit'), value: fmtMoney(d.profit) },
                      { color: c.primary, label: t('Circularity score'), value: d.score === null ? '—' : `${d.score}` },
                    ]}
                  />
                );
              }}
            />
            <Bar yAxisId="m" dataKey="profit" radius={[4, 4, 0, 0]} maxBarSize={28} animationDuration={800}>
              {data.map((d) => (
                <Cell key={d.label} fill={d.profit < 0 ? c.negative : c.money} />
              ))}
            </Bar>
            <Line yAxisId="s" dataKey="score" stroke={c.primary} strokeWidth={2.5} dot={{ r: 3, fill: c.primary }} connectNulls animationDuration={900} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/** Each product's two grades: profit per item and circularity score. */
function ProductsAtAGlance() {
  useT();
  const { products } = useStore();
  const navigate = useNavigate();
  const rows = [...products].sort((a, b) => b.circularityScore - a.circularityScore).slice(0, 5);
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title={t('Your products')}
        sub={t('What each one earns, and how circular it is')}
        right={
          <Link to="/app/products" className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300">
            {t('See all')}
          </Link>
        }
      />
      {rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <p className="muted text-sm">{t('Add your products and what they are made of to see how each one is doing.')}</p>
          <button className="btn-primary btn-sm mt-3" onClick={() => navigate('/app/products?new=product')}>
            <Plus className="h-3.5 w-3.5" /> {t('Add product')}
          </button>
        </div>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">{t('Product')}</th>
                <th className="th text-end">
                  <Term label={t('Profit per item')}>{t('What you keep from each sale: the price minus what the item cost you to make or buy.')}</Term>
                </th>
                <th className="th text-end">
                  <Term label={t('Circularity score')}>{t('For a product, the score is the share of its weight that comes from recycled or reused materials.')}</Term>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const per = p.price - p.unitCost;
                return (
                  <tr key={p.id} className="tr">
                    <td className="td font-medium">{p.name}</td>
                    <td className={clsx('td text-end tabular-nums', per < 0 && 'text-red-600 dark:text-red-400')}>{fmtMoney(per)}</td>
                    <td className="td text-end">
                      <span className="inline-flex items-center gap-2">
                        <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-gray-100 sm:block dark:bg-white/5">
                          <span className="block h-full rounded-full bg-brand-600 dark:bg-brand-400" style={{ width: `${p.circularityScore}%` }} />
                        </span>
                        <span className="w-8 font-semibold tabular-nums">{p.circularityScore}</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export function GoalsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useT();
  const { goals, setGoals } = useStore();
  const [profit, setProfit] = useState('');
  const [score, setScore] = useState('');
  useEffect(() => {
    if (open) {
      setProfit(goals.monthlyProfit ? String(goals.monthlyProfit) : '');
      setScore(goals.circularityScore ? String(goals.circularityScore) : '');
    }
  }, [open, goals]);
  const scoreN = score ? +score : null;
  const err = scoreN !== null && (scoreN < 1 || scoreN > 100) ? t('Choose a score between 1 and 100') : null;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('Your goals')}
      sub={t('Set one goal for money and one for circularity. Your progress shows on your dashboard.')}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            {t('Cancel')}
          </button>
          <button
            className="btn-primary"
            disabled={!!err}
            onClick={() => {
              setGoals({ monthlyProfit: profit ? Math.max(0, +profit) || null : null, circularityScore: scoreN });
              onClose();
            }}
          >
            {t('Save goals')}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={t('Profit goal for each month ($)')} hint={t('Leave empty for no goal.')}>
          <input type="number" min={0} className="input" value={profit} onChange={(e) => setProfit(e.target.value)} />
        </Field>
        <Field label={t('Circularity score goal (1–100)')} error={err} hint={t('Circular Grower starts at {a}, Circular Leader at {b}.', { a: LEVEL_FROM.grower, b: LEVEL_FROM.leader })}>
          <input type="number" min={1} max={100} className="input" value={score} onChange={(e) => setScore(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

export default function Home() {
  useT();
  const { profile } = useStore();
  const navigate = useNavigate();
  const ready = useSimulatedLoad('home', 500);
  const [importing, setImporting] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const firstName = profile.ownerName.trim().split(' ')[0];

  return (
    <>
      <PageHeader
        title={firstName ? t('{greeting}, {name}', { greeting: greeting(), name: firstName }) : greeting()}
        sub={profile.businessName ? t('How {name} is doing with money and with circularity', { name: profile.businessName }) : t('How your business is doing with money and with circularity')}
        actions={
          <>
            <button className="btn-secondary" onClick={() => setGoalsOpen(true)}>
              <Target className="h-4 w-4" /> {t('Goals')}
            </button>
            <button className="btn-secondary" onClick={() => setImporting(true)}>
              <Upload className="h-4 w-4" /> {t('Import sales')}
            </button>
            <button className="btn-primary" onClick={() => navigate('/app/money?new=txn')}>
              <Plus className="h-4 w-4" /> {t('Record money in or out')}
            </button>
          </>
        }
      />
      <LowStockBanner />
      <GettingStarted onImportSales={() => setImporting(true)} />
      {!ready ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <CardSkeleton className="h-[380px]" lines={6} />
          <CardSkeleton className="h-[380px]" lines={6} />
          <CardSkeleton chart className="h-[360px] lg:col-span-2" />
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-12 lg:col-span-6">
            <MoneyCard onGoals={() => setGoalsOpen(true)} />
          </div>
          <div className="col-span-12 lg:col-span-6">
            <ScoreCard onGoals={() => setGoalsOpen(true)} />
          </div>
          <div className="col-span-12">
            <TwoBottomLines />
          </div>
          <div className="col-span-12 xl:col-span-7">
            <ProductsAtAGlance />
          </div>
          <div className="col-span-12 xl:col-span-5">
            <InsightsFeed title={t('Next steps')} />
          </div>
        </div>
      )}
      <ImportModal open={importing} onClose={() => setImporting(false)} mode="sales" />
      <GoalsModal open={goalsOpen} onClose={() => setGoalsOpen(false)} />
    </>
  );
}
