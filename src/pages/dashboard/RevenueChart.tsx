import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Area, CartesianGrid, ComposedChart, Line, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarRange, MousePointerClick, Upload } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { buildSeries, granularityFor, pctChange, rangeWindow, type RangeKey, type SeriesPoint } from '../../lib/metrics';
import { useChartColors } from '../../lib/hooks';
import { addDays, fmtCompactMoney, fmtDate, fmtMoney, fmtPct, startOfToday, toISO } from '../../lib/format';
import { Card, CardHeader, Delta, Modal, Segmented } from '../../components/ui';
import { LegendItem, TooltipBox } from '../../components/charts/ChartTooltip';
import { tk, useLang, useT } from '../../i18n';

const RANGES: { value: RangeKey; label: string }[] = [
  { value: '30D', label: tk('30D') },
  { value: '90D', label: tk('90D') },
  { value: 'YTD', label: tk('YTD') },
  { value: '12M', label: tk('12M') },
  { value: 'Custom', label: tk('Custom') },
];

export function RevenueChart({ onImportSales }: { onImportSales: () => void }) {
  const t = useT();
  const { lang } = useLang();
  const navigate = useNavigate();
  const { ledger, products, filteredProductIds, theme, transactions } = useStore();
  const c = useChartColors(theme);
  // Default to 12 months so the holiday peak / summer bump are visible.
  const [range, setRange] = useState<RangeKey>('12M');
  const [custom, setCustom] = useState({ from: toISO(addDays(startOfToday(), -180)), to: toISO(startOfToday()) });
  const [showPrior, setShowPrior] = useState(true);
  const [drill, setDrill] = useState<SeriesPoint | null>(null);

  const w = useMemo(() => rangeWindow(range, custom), [range, custom]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- bucket labels follow the language
  const data = useMemo(() => buildSeries(ledger, products, w, filteredProductIds), [ledger, products, w, filteredProductIds, lang]);
  const g = granularityFor(w);

  const totals = data.reduce((a, d) => ({ rev: a.rev + d.revenue, prof: a.prof + d.profit }), { rev: 0, prof: 0 });
  // Compare only buckets that have prior-period history, so a short history doesn't inflate the delta.
  const comparable = data.filter((d) => d.prevRevenue !== null);
  const priorDelta = comparable.length
    ? pctChange(
        comparable.reduce((s, d) => s + d.revenue, 0),
        comparable.reduce((s, d) => s + (d.prevRevenue ?? 0), 0),
      )
    : null;
  const partialPrior = comparable.length > 0 && comparable.length < data.length;
  const peak = data.reduce<SeriesPoint | null>((m, d) => (!m || d.revenue > m.revenue ? d : m), null);

  const drillTx = useMemo(() => {
    if (!drill) return [];
    return transactions
      .filter((x) => x.date >= drill.from && x.date <= drill.to && (!filteredProductIds || (x.productId && filteredProductIds.has(x.productId))))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [drill, transactions, filteredProductIds]);

  const drillByProduct = useMemo(() => {
    const m = new Map<string, { units: number; revenue: number }>();
    for (const x of drillTx) {
      if (x.type !== 'inflow' || !x.productId) continue;
      const cur = m.get(x.productId) ?? { units: 0, revenue: 0 };
      cur.units += x.quantity ?? 0;
      cur.revenue += x.amount;
      m.set(x.productId, cur);
    }
    return [...m.entries()].map(([id, v]) => ({ ...v, name: products.find((p) => p.id === id)?.name ?? id })).sort((a, b) => b.revenue - a.revenue);
  }, [drillTx, products]);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title={t('Revenue vs profit')}
        sub={
          <span>
            {fmtDate(toISO(w.from))} – {fmtDate(toISO(w.to))} · {g === 'day' ? t('daily') : g === 'week' ? t('weekly') : t('monthly')}
            {filteredProductIds && ` · ${t('filtered')}`}
          </span>
        }
        right={<Segmented options={RANGES.map((r) => ({ ...r, label: t(r.label) }))} value={range} onChange={setRange} />}
      />
      {range === 'Custom' && (
        <div className="mx-5 mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 p-2 text-xs dark:bg-white/[0.03]">
          <CalendarRange className="h-4 w-4 text-gray-400" />
          <input type="date" className="input w-auto py-1 text-xs" value={custom.from} max={custom.to} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
          <span className="muted">{t('to')}</span>
          <input type="date" className="input w-auto py-1 text-xs" value={custom.to} min={custom.from} max={toISO(startOfToday())} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
        </div>
      )}
      <div className="flex flex-wrap items-end gap-x-8 gap-y-2 px-5 pt-4">
        <div>
          <p className="muted text-xs">{t('Revenue')}</p>
          <p className="num text-2xl">{fmtMoney(totals.rev)}</p>
        </div>
        <div>
          <p className="muted text-xs">{t('Net profit')}</p>
          <p className="num text-2xl">{fmtMoney(totals.prof)}</p>
        </div>
        <div>
          <p className="muted text-xs">{partialPrior ? t('vs prior period (overlap)') : t('vs prior period')}</p>
          {priorDelta === null ? <span className="muted text-sm">{t('No history')}</span> : <Delta value={priorDelta} className="text-sm" />}
        </div>
        <div className="ms-auto flex flex-wrap items-center gap-3 pb-1">
          <LegendItem color={c.primary} label={t('Revenue')} />
          <LegendItem color={c.secondary} label={t('Net profit')} />
          <button onClick={() => setShowPrior((s) => !s)} className={showPrior ? '' : 'opacity-40'} title={t('Toggle prior-period overlay')}>
            <LegendItem color={c.neutral} label={t('Prior period')} dashed />
          </button>
        </div>
      </div>
      <div className="relative h-[300px] flex-1 px-2 pb-2 pt-3" dir="ltr">
        {totals.rev === 0 && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm font-semibold">{t('No sales in this period yet')}</p>
            <p className="muted max-w-xs text-xs">{t('Log or import sales to see revenue, profit and seasonal trends here.')}</p>
            <div className="mt-1 flex gap-2">
              <button className="btn-secondary btn-sm" onClick={onImportSales}>
                <Upload className="h-3.5 w-3.5" /> {t('Import sales')}
              </button>
              <button className="btn-primary btn-sm" onClick={() => navigate('/app/transactions?new=txn')}>
                {t('Log a sale')}
              </button>
            </div>
          </div>
        )}
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 24, right: 16, left: 4, bottom: 0 }}
            onClick={(s) => {
              const p = (s as { activePayload?: { payload: SeriesPoint }[] } | null)?.activePayload?.[0]?.payload;
              if (p) setDrill(p);
            }}
            className="cursor-pointer"
          >
            <defs>
              <linearGradient id="revFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={c.primary} stopOpacity={0.22} />
                <stop offset="100%" stopColor={c.primary} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={c.grid} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: c.axis }} minTickGap={24} dy={6} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: c.axis }} tickFormatter={fmtCompactMoney} width={68} />
            <Tooltip
              cursor={{ stroke: c.axis, strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0]!.payload as SeriesPoint;
                return (
                  <TooltipBox
                    title={g === 'day' ? fmtDate(p.from) : `${fmtDate(p.from)} – ${fmtDate(p.to)}`}
                    rows={[
                      { color: c.primary, label: t('Revenue'), value: fmtMoney(p.revenue) },
                      { color: c.secondary, label: t('Net profit'), value: fmtMoney(p.profit) },
                      ...(showPrior && p.prevRevenue !== null ? [{ color: c.neutral, label: t('Prior period'), value: fmtMoney(p.prevRevenue), dashed: true }] : []),
                    ]}
                    footer={
                      <span className="inline-flex items-center gap-1">
                        <MousePointerClick className="h-3 w-3" /> {t('Click for breakdown')}
                      </span>
                    }
                  />
                );
              }}
            />
            {showPrior && <Line type="monotone" dataKey="prevRevenue" stroke={c.neutral} strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={false} animationDuration={900} />}
            <Area type="monotone" dataKey="revenue" stroke={c.primary} strokeWidth={2} fill="url(#revFill)" activeDot={{ r: 5, strokeWidth: 2, stroke: c.surface }} animationDuration={900} />
            <Line type="monotone" dataKey="profit" stroke={c.secondary} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: c.surface }} animationDuration={900} />
            {peak && peak.revenue > 0 && (
              <ReferenceDot
                x={peak.label}
                y={peak.revenue}
                r={5}
                fill={c.primary}
                stroke={c.surface}
                strokeWidth={2}
                label={{ value: `${t('Peak')} · ${fmtCompactMoney(peak.revenue)}`, position: 'top', fontSize: 11, fontWeight: 600, fill: theme === 'dark' ? '#E5E7EB' : '#111827', offset: 10 }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <Modal
        open={!!drill}
        onClose={() => setDrill(null)}
        size="lg"
        title={drill ? (drill.from === drill.to ? fmtDate(drill.from) : `${fmtDate(drill.from)} – ${fmtDate(drill.to)}`) : ''}
        sub={t('Period breakdown')}
      >
        {drill && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              {[
                [t('Revenue'), fmtMoney(drill.revenue), drill.prevRevenue === null ? null : pctChange(drill.revenue, drill.prevRevenue)],
                [t('Net profit'), fmtMoney(drill.profit), drill.prevProfit === null ? null : pctChange(drill.profit, drill.prevProfit)],
                [t('Circularity'), fmtPct(drill.circularity, 0), null],
              ].map(([k, v, d]) => (
                <div key={k as string} className="rounded-lg border border-gray-200 p-3 dark:border-white/10">
                  <p className="muted text-xs">{k}</p>
                  <p className="num mt-0.5 text-lg">{v}</p>
                  {d !== null && <Delta value={d as number} />}
                </div>
              ))}
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">{t('Sales by product')}</p>
              <div className="space-y-2">
                {drillByProduct.map((p) => (
                  <div key={p.name} className="flex items-center gap-3 text-sm">
                    <span className="w-44 truncate">{p.name}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
                      <div className="h-full rounded-full bg-brand-600 dark:bg-brand-400" style={{ width: `${(p.revenue / (drillByProduct[0]?.revenue || 1)) * 100}%` }} />
                    </div>
                    <span className="w-16 text-end tabular-nums text-gray-500">{t('{n} u', { n: p.units })}</span>
                    <span className="w-20 text-end font-medium tabular-nums">{fmtMoney(p.revenue)}</span>
                  </div>
                ))}
                {drillByProduct.length === 0 && <p className="muted text-sm">{t('No product sales in this period.')}</p>}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">{t('Transactions ({count})', { count: drillTx.length })}</p>
              <div className="scrollbar-thin max-h-60 overflow-y-auto rounded-lg border border-gray-200 dark:border-white/10">
                <table className="w-full">
                  <tbody>
                    {drillTx.slice(0, 100).map((x) => (
                      <tr key={x.id} className="tr">
                        <td className="td text-gray-500">{fmtDate(x.date)}</td>
                        <td className="td">{x.productId ? products.find((p) => p.id === x.productId)?.name : x.note ?? t(x.category)}</td>
                        <td className={`td text-end font-medium tabular-nums ${x.type === 'inflow' ? 'text-brand-700 dark:text-brand-400' : ''}`}>
                          <span dir="ltr">
                            {x.type === 'inflow' ? '+' : '−'}
                            {fmtMoney(x.amount)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="muted text-xs">{t('Recurring costs are spread across the period they cover (accrual view).')}</p>
          </div>
        )}
      </Modal>
    </Card>
  );
}
