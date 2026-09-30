import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import clsx from 'clsx';
import { AlertTriangle, Check, ChevronDown, Lightbulb, Lock, Rocket, Sparkles, TrendingUp, Upload, X, Zap } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { useChartColors } from '../../lib/hooks';
import { fmtDate, fmtKg, fmtMoney, fmtPct } from '../../lib/format';
import { tk, useT } from '../../i18n';
import { historyDays, lastNDays, milestoneStages, reliabilityScore, totalsFor, avgKnown } from '../../lib/metrics';
import { AnimatedNumber, Badge, Card, CardHeader, EmptyState, Segmented, Sparkline, StatusBadge, StockBar, Tip } from '../../components/ui';
import { TooltipBox } from '../../components/charts/ChartTooltip';
import type { InsightKind, MaterialClass } from '../../types';

/* ---------------- KPI card ---------------- */

/** value / delta are null when there's no real data to show or compare against — the card shows "—" and no change badge. */
export function KpiCard({ label, value, format, delta, spark, icon, invert, hint }: { label: string; value: number | null; format: (n: number) => string; delta: number | null; spark: number[]; icon: React.ReactNode; invert?: boolean; hint?: string }) {
  const t = useT();
  const good = delta === null ? true : invert ? delta < 0 : delta >= 0;
  return (
    <Card hover className="group relative overflow-hidden p-5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-50 text-gray-500 ring-1 ring-gray-100 dark:bg-white/5 dark:text-gray-400 dark:ring-white/5">{icon}</span>
          {label}
        </span>
        {delta !== null && (
          <span
            dir="ltr"
            className={clsx(
              'rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
              Math.abs(delta) < 0.05 ? 'bg-gray-100 text-gray-500 dark:bg-white/5' : good ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300' : 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300',
            )}
          >
            {delta >= 0 ? '+' : '−'}
            {fmtPct(Math.abs(delta))}
          </span>
        )}
      </div>
      <AnimatedNumber value={value} format={format} className="mt-3 block text-[28px] font-bold leading-none tracking-tight" />
      <div className="mt-1 flex items-end justify-between gap-3">
        <p className="muted text-[11px]">{hint ?? t('vs previous 30 days')}</p>
      </div>
      <div className={clsx('mt-3', good ? 'text-brand-600 dark:text-brand-400' : 'text-red-500 dark:text-red-400')}>
        <Sparkline data={spark} />
      </div>
    </Card>
  );
}

/* ---------------- Low stock banner ---------------- */

export function LowStockBanner() {
  const t = useT();
  const { inventory } = useStore();
  const navigate = useNavigate();
  const [hidden, setHidden] = useState(false);
  const critical = inventory.filter((r) => r.status === 'critical');
  const reorder = inventory.filter((r) => r.status === 'reorder');
  if (hidden || (!critical.length && !reorder.length)) return null;
  const isRed = critical.length > 0;
  const items = [...critical, ...reorder];
  return (
    <div
      className={clsx(
        'mb-6 flex animate-page-in flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center',
        isRed ? 'border-red-200 bg-red-50 dark:border-red-500/20 dark:bg-red-500/[0.07]' : 'border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/[0.07]',
      )}
      role="alert"
    >
      <div className={clsx('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', isRed ? 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400')}>
        <AlertTriangle className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className={clsx('text-sm font-semibold', isRed ? 'text-red-800 dark:text-red-200' : 'text-amber-800 dark:text-amber-200')}>
          {critical.length > 0 && t('{count} products below low-stock threshold', { count: critical.length })}
          {critical.length > 0 && reorder.length > 0 && ' · '}
          {reorder.length > 0 && t('{count} at reorder point', { count: reorder.length })}
        </p>
        <p className={clsx('truncate text-xs', isRed ? 'text-red-700/80 dark:text-red-300/80' : 'text-amber-700/80 dark:text-amber-300/80')}>
          {items
            .map((r) => `${r.product.name} (${Number.isFinite(r.daysOfCover) ? t('{n} left, ~{d}d cover', { n: r.product.stockOnHand, d: Math.floor(r.daysOfCover) }) : t('{n} left', { n: r.product.stockOnHand })})`)
            .join(' · ')}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button className={clsx('btn btn-sm text-white', isRed ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700')} onClick={() => navigate('/app/products/inventory')}>
          {t('View inventory')}
        </button>
        <button className="icon-btn h-8 w-8" onClick={() => setHidden(true)} aria-label={t('Dismiss')}>
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ---------------- Material mix donut ---------------- */

export function MaterialMix() {
  const t = useT();
  const { circ30, materialFilter, setMaterialFilter, theme } = useStore();
  const c = useChartColors(theme);
  const color: Record<MaterialClass, string> = { Recycled: c.primary, Reused: c.secondary, Virgin: c.tertiary };
  const data = (['Recycled', 'Reused', 'Virgin'] as MaterialClass[]).map((k) => ({ name: k, kg: circ30.byClass[k], pct: circ30.totalKg ? (circ30.byClass[k] / circ30.totalKg) * 100 : 0 }));
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title={t('Material mix')}
        sub={t('By weight sold · last 30 days')}
        right={
          materialFilter && (
            <button className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400" onClick={() => setMaterialFilter(null)}>
              {t('Clear filter')}
            </button>
          )
        }
      />
      <div className="relative mx-auto mt-2 h-[200px] w-full max-w-[240px]" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="kg"
              nameKey="name"
              innerRadius="68%"
              outerRadius="96%"
              paddingAngle={2}
              stroke={c.surface}
              strokeWidth={2}
              cornerRadius={4}
              onClick={(d: { name: MaterialClass }) => setMaterialFilter(materialFilter === d.name ? null : d.name)}
              animationDuration={900}
              className="cursor-pointer"
            >
              {data.map((d) => (
                <Cell key={d.name} fill={color[d.name]} opacity={!materialFilter || materialFilter === d.name ? 1 : 0.25} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]!.payload as (typeof data)[number];
                return <TooltipBox title={t(d.name)} rows={[{ color: color[d.name], label: t('Weight'), value: fmtKg(d.kg) }, { color: color[d.name], label: t('Share'), value: fmtPct(d.pct) }]} footer={t('Click to filter the dashboard')} />;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {circ30.totalKg === 0 && <div className="absolute left-1/2 top-1/2 h-[184px] w-[184px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[14px] border-gray-100 dark:border-white/[0.06]" />}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <AnimatedNumber value={circ30.hasData ? circ30.rate : null} format={(n) => fmtPct(n)} className="text-2xl font-bold" />
          <span className="muted text-[11px]">{t('circular')}</span>
        </div>
      </div>
      <ul className="mt-auto space-y-1 px-3 pb-3 pt-2">
        {data.map((d) => (
          <li key={d.name}>
            <button
              onClick={() => setMaterialFilter(materialFilter === d.name ? null : d.name)}
              className={clsx(
                'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition',
                materialFilter === d.name ? 'bg-brand-50 ring-1 ring-brand-600/20 dark:bg-brand-500/10' : 'hover:bg-gray-50 dark:hover:bg-white/[0.03]',
              )}
            >
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color[d.name] }} />
              <span className="flex-1 text-start">{t(d.name)}</span>
              <span className="muted tabular-nums">{fmtKg(d.kg)}</span>
              <span className="w-12 text-end font-semibold tabular-nums">{fmtPct(d.pct, 0)}</span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ---------------- Milestone stepper ---------------- */

export function MilestoneCard() {
  const t = useT();
  const { circ30, suppliers, products, transactions } = useStore();
  const avgRel = avgKnown(suppliers.map((x) => reliabilityScore(x))) ?? 0;
  const rate = circ30.hasData ? circ30.rate : 0;
  const hist = useMemo(() => historyDays(transactions), [transactions]);
  const stages = milestoneStages({ rate, suppliers: suppliers.length, products: products.length, avgReliability: avgRel, historyDays: hist });
  const achieved = stages.map((s) => s.criteria.every((c) => c.met));
  const currentIdx = Math.max(0, achieved.lastIndexOf(true));
  const next = stages[currentIdx + 1];
  const progress = next ? Math.min(100, (rate / next.min) * 100) : 100;
  const icons = [Sparkles, TrendingUp, Rocket];

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="card-title">{t('Next milestone')}</h3>
          <p className="card-sub mt-0.5">{next ? t('{count} criteria left to reach {name}', { count: next.criteria.filter((c) => !c.met).length, name: next.name }) : t('Top tier reached — keep it up')}</p>
        </div>
        <Badge tone="green">{stages[currentIdx]!.name}</Badge>
      </div>
      <div className="relative mt-6 grid grid-cols-3">
        <div className="absolute end-[16.66%] start-[16.66%] top-4 h-1 rounded-full bg-gray-100 dark:bg-white/[0.06]" />
        <div
          className="absolute start-[16.66%] top-4 h-1 rounded-full bg-brand-600 transition-all duration-1000 ease-out dark:bg-brand-400"
          style={{ width: `${(66.66 * (currentIdx + (next ? progress / 100 : 0))) / 2}%` }}
        />
        {stages.map((s, i) => {
          const Icon = icons[i]!;
          const done = achieved[i];
          const isNext = i === currentIdx + 1;
          return (
            <Tip
              key={s.name}
              side="bottom"
              className="justify-center"
              content={
                <span className="block">
                  <span className="mb-1 block font-semibold">{t('Unlock criteria')}</span>
                  {s.criteria.map((c) => (
                    <span key={c.label} className="flex items-center gap-1.5">
                      {c.met ? <Check className="h-3 w-3 text-brand-300" /> : <Lock className="h-3 w-3 text-gray-400" />}
                      {c.label}
                    </span>
                  ))}
                </span>
              }
            >
              <div className="relative flex cursor-help flex-col items-center text-center">
                <span
                  className={clsx(
                    'z-10 flex h-9 w-9 items-center justify-center rounded-full ring-4 ring-white transition dark:ring-ink-900',
                    done ? 'bg-brand-600 text-white dark:bg-brand-500' : isNext ? 'bg-white text-brand-600 ring-brand-100 outline outline-2 outline-brand-600 dark:bg-ink-900 dark:text-brand-400 dark:outline-brand-400' : 'bg-gray-100 text-gray-400 dark:bg-white/5',
                  )}
                >
                  {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </span>
                <span className={clsx('mt-2 text-xs font-semibold', done || isNext ? '' : 'text-gray-400')}>{s.name}</span>
                <span className="muted text-[11px]">{s.min ? t('≥ {pct} circular', { pct: fmtPct(s.min, 0) }) : t('Getting started')}</span>
              </div>
            </Tip>
          );
        })}
      </div>
      {next && (
        <div className="mt-5 rounded-lg bg-gray-50 p-3 text-xs dark:bg-white/[0.03]">
          <div className="flex items-center justify-between">
            <span className="muted">{t('Circularity toward {name}', { name: next.name })}</span>
            <span className="font-semibold tabular-nums">
              {circ30.hasData ? fmtPct(circ30.rate) : '—'} / {fmtPct(next.min, 0)}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
            <div className="h-full rounded-full bg-brand-600 transition-all duration-1000 dark:bg-brand-400" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
    </Card>
  );
}

/* ---------------- Circular Insights feed ---------------- */

const kindMeta: Record<InsightKind, { icon: typeof Zap; label: string; cls: string }> = {
  optimization: { icon: Zap, label: tk('Optimization'), cls: 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300' },
  alert: { icon: AlertTriangle, label: tk('Alert'), cls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' },
  opportunity: { icon: Lightbulb, label: tk('Opportunity'), cls: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300' },
};

export function InsightsFeed() {
  const t = useT();
  const { insights, dismissInsight, applyMaterialSwitch, restoreInsights, dismissedInsights } = useStore();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | InsightKind>('all');
  const shown = insights.filter((i) => filter === 'all' || i.kind === filter);
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-600 dark:text-brand-400" /> {t('Circular insights')}
          </span>
        }
        sub={t('{count} active · generated from your data', { count: insights.length })}
      />
      <div className="px-5 pt-3">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: t('All') },
            { value: 'alert', label: t('Alerts') },
            { value: 'optimization', label: t('Optimize') },
            { value: 'opportunity', label: t('Opportunities') },
          ]}
        />
      </div>
      <div className="scrollbar-thin mt-3 max-h-[520px] flex-1 space-y-2.5 overflow-y-auto px-5 pb-5">
        {shown.length === 0 && (
          <EmptyState
            icon={<Check className="h-6 w-6" />}
            title={t('No insights right now')}
            body={t('Insights appear as you add products, suppliers and sales, and update as your data changes.')}
            action={dismissedInsights.length > 0 && <button className="btn-secondary btn-sm" onClick={restoreInsights}>{t('Restore dismissed ({count})', { count: dismissedInsights.length })}</button>}
          />
        )}
        {shown.map((i) => {
          const meta = kindMeta[i.kind];
          const Icon = meta.icon;
          return (
            <div key={i.id} className="group animate-pop-in rounded-xl border border-gray-100 bg-gray-50/50 p-3.5 transition hover:border-gray-200 hover:bg-white hover:shadow-card dark:border-white/5 dark:bg-white/[0.02] dark:hover:bg-white/[0.04]">
              <div className="flex gap-3">
                <span className={clsx('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', meta.cls)}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold leading-snug">{i.title}</p>
                    <button className="-me-1 -mt-0.5 rounded p-0.5 text-gray-300 opacity-0 transition hover:text-gray-600 group-hover:opacity-100 dark:hover:text-gray-200" onClick={() => dismissInsight(i.id)} aria-label={t('Dismiss insight')}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="muted mt-1 text-xs leading-relaxed">{i.body}</p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <Badge tone={i.kind === 'alert' ? 'amber' : i.kind === 'opportunity' ? 'blue' : 'green'}>{i.impact}</Badge>
                    <Badge tone="gray">{t('{level} confidence', { level: t(i.confidence) })}</Badge>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      className="btn-primary btn-sm"
                      onClick={() => {
                        if (i.action.type === 'navigate') navigate(i.action.to);
                        else {
                          applyMaterialSwitch(i.action.productId, i.action.materialName);
                          dismissInsight(i.id);
                        }
                      }}
                    >
                      {i.actionLabel}
                    </button>
                    <button className="btn-ghost btn-sm" onClick={() => dismissInsight(i.id)}>
                      {t('Dismiss')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ---------------- Products & activity (tabbed, collapsible) ---------------- */

export function ActivityCard() {
  const t = useT();
  const { ledger, products, inventory, transactions, filteredProductIds } = useStore();
  const [tab, setTab] = useState<'top' | 'inventory' | 'recent'>('top');
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const t30 = useMemo(() => totalsFor(ledger, lastNDays(30), filteredProductIds), [ledger, filteredProductIds]);
  const top = products
    .filter((p) => !filteredProductIds || filteredProductIds.has(p.id))
    .map((p) => ({ p, units: t30.units[p.id] ?? 0, revenue: (t30.units[p.id] ?? 0) * p.price }))
    .sort((a, b) => b.revenue - a.revenue);
  const maxRev = top[0]?.revenue || 1;
  const recent = useMemo(() => [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, 8), [transactions]);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'top', label: t('Top products') },
            { value: 'inventory', label: t('Inventory health') },
            { value: 'recent', label: t('Recent activity') },
          ]}
        />
        <button className="icon-btn h-8 w-8" onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? t('Expand') : t('Collapse')}>
          <ChevronDown className={clsx('h-4 w-4 transition-transform', collapsed && '-rotate-90 rtl:rotate-90')} />
        </button>
      </div>
      <div className={clsx('grid transition-all duration-200', collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]')}>
        <div className="overflow-hidden">
          <div className="overflow-x-auto p-2 pt-3">
            {tab === 'top' && (
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="th">{t('Product')}</th>
                    <th className="th">{t('Revenue (30d)')}</th>
                    <th className="th text-end">{t('Units')}</th>
                    <th className="th text-end" title={t('Share of this product’s weight from recycled or reused materials')}>
                      {t('Material circularity')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {top.length === 0 && (
                    <tr>
                      <td colSpan={4} className="muted px-4 py-8 text-center text-sm">{t('Your best-selling products will appear here.')}</td>
                    </tr>
                  )}
                  {top.map(({ p, units, revenue }) => (
                    <tr key={p.id} className="tr cursor-pointer" onClick={() => navigate(`/app/products?open=${p.id}`)}>
                      <td className="td font-medium">{p.name}</td>
                      <td className="td">
                        <div className="flex items-center gap-3">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
                            <div className="h-full rounded-full bg-brand-600 dark:bg-brand-400" style={{ width: `${(revenue / maxRev) * 100}%` }} />
                          </div>
                          <span className="tabular-nums">{fmtMoney(revenue)}</span>
                        </div>
                      </td>
                      <td className="td text-end tabular-nums">{units}</td>
                      <td className="td text-end font-semibold tabular-nums">{fmtPct(p.circularityScore, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {tab === 'inventory' && (
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="th">{t('Product')}</th>
                    <th className="th w-1/3">{t('Stock level')}</th>
                    <th className="th text-end">{t('Cover')}</th>
                    <th className="th text-end">{t('Status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.length === 0 && (
                    <tr>
                      <td colSpan={4} className="muted px-4 py-8 text-center text-sm">{t('Add products with stock levels to track inventory health.')}</td>
                    </tr>
                  )}
                  {inventory.map((r) => (
                    <tr key={r.product.id} className="tr cursor-pointer" onClick={() => navigate('/app/products/inventory')}>
                      <td className="td font-medium">{r.product.name}</td>
                      <td className="td">
                        <StockBar stock={r.product.stockOnHand} threshold={r.product.lowStockThreshold} reorderPoint={r.reorderPoint} compact />
                      </td>
                      <td className="td text-end tabular-nums">{Number.isFinite(r.daysOfCover) ? t('{n}d', { n: Math.floor(r.daysOfCover) }) : '—'}</td>
                      <td className="td text-end">
                        <StatusBadge status={r.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {tab === 'recent' && (
              <table className="w-full">
                <tbody>
                  {recent.length === 0 && (
                    <tr>
                      <td colSpan={4} className="muted px-4 py-8 text-center text-sm">{t('Sales and expenses you log will appear here.')}</td>
                    </tr>
                  )}
                  {recent.map((x) => (
                    <tr key={x.id} className="tr">
                      <td className="td text-gray-500">{fmtDate(x.date)}</td>
                      <td className="td">
                        <span className="font-medium">{x.productId ? products.find((p) => p.id === x.productId)?.name : t(x.category)}</span>
                        {x.quantity && <span className="muted"> × {x.quantity}</span>}
                      </td>
                      <td className="td">
                        <Badge tone={x.type === 'inflow' ? 'green' : 'gray'}>{t(x.category)}</Badge>
                      </td>
                      <td className={clsx('td text-end font-medium tabular-nums', x.type === 'inflow' && 'text-brand-700 dark:text-brand-400')}>
                        <span dir="ltr">
                          {x.type === 'inflow' ? '+' : '−'}
                          {fmtMoney(x.amount)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ---------------- Getting started (new accounts) ---------------- */

export function GettingStarted({ onImportSales }: { onImportSales: () => void }) {
  const t = useT();
  const { profile, products, suppliers, transactions } = useStore();
  const navigate = useNavigate();
  const steps = [
    { label: t('Complete your business profile'), body: t('Name, industry and what you make.'), done: !!profile.businessName.trim(), to: '/onboarding', cta: t('Set up profile') },
    { label: t('Add your first product'), body: t('List its materials so Tokuma can score circularity.'), done: products.length > 0, to: '/app/products?new=product', cta: t('Add product') },
    { label: t('Add a supplier'), body: t('Lead times drive your automatic reorder points.'), done: suppliers.length > 0, to: '/app/supply-chain?new=supplier', cta: t('Add supplier') },
    { label: t('Log your first sale'), body: t('Sales power revenue, circularity and customer insights. Log one, or import a sales export.'), done: transactions.some((x) => x.type === 'inflow'), to: '/app/transactions?new=txn', cta: t('Log sale'), sale: true },
  ];
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  const next = steps.findIndex((s) => !s.done);
  return (
    <Card className="mb-6 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
        <div>
          <h3 className="card-title">{t('Get started with Tokuma')}</h3>
          <p className="card-sub mt-0.5">{t('Your dashboard fills in as you add your own data.')}</p>
        </div>
        <span className="text-xs font-semibold tabular-nums text-brand-700 dark:text-brand-400">
          {t('{done} of {total} done', { done, total: steps.length })}
        </span>
      </div>
      <div className="mx-5 mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
        <div className="h-full rounded-full bg-brand-600 transition-all duration-700 dark:bg-brand-400" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((s, i) => (
          <li
            key={s.to}
            className={clsx(
              'flex flex-col rounded-xl border p-4 transition',
              s.done ? 'border-gray-100 bg-gray-50/60 dark:border-white/5 dark:bg-white/[0.02]' : i === next ? 'border-brand-200 bg-brand-50/50 dark:border-brand-500/30 dark:bg-brand-500/[0.06]' : 'border-gray-200 dark:border-white/10',
            )}
          >
            <span className={clsx('flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold', s.done ? 'bg-brand-600 text-white' : 'bg-white text-gray-500 ring-1 ring-gray-200 dark:bg-ink-850 dark:text-gray-300 dark:ring-white/10')}>
              {s.done ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <p className={clsx('mt-3 text-sm font-semibold', s.done && 'text-gray-400 line-through dark:text-gray-500')}>{s.label}</p>
            <p className="muted mt-1 flex-1 text-xs">{s.body}</p>
            {!s.done && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button className={i === next ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} onClick={() => navigate(s.to)}>
                  {s.cta}
                </button>
                {'sale' in s && (
                  <button className="btn-secondary btn-sm" onClick={onImportSales}>
                    <Upload className="h-3.5 w-3.5" /> {t('Import sales')}
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}
