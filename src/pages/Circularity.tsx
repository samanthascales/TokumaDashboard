import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, Info, Leaf, Package, Recycle, Scale, Wand2 } from 'lucide-react';
import { useStore } from '../store/AppStore';
import { useChartColors, useSimulatedLoad } from '../lib/hooks';
import { fmtInt, fmtKg, fmtNum, fmtPct } from '../lib/format';
import { useLang, useT } from '../i18n';
import { buildSeries, lastNDays, type Recommendation } from '../lib/metrics';
import { AnimatedNumber, Badge, Card, CardHeader, CardSkeleton, Delta, EmptyState, Modal, PageHeader, Ring, Segmented } from '../components/ui';
import { LegendItem, TooltipBox } from '../components/charts/ChartTooltip';
import type { MaterialClass } from '../types';

function RecommendationCarousel() {
  const t = useT();
  const { recs, applyMaterialSwitch, theme, role, products } = useStore();
  const c = useChartColors(theme);
  const [i, setI] = useState(0);
  if (!recs.length)
    return (
      <Card className="h-full">
        <CardHeader title={t('Strategy recommendations')} />
        {products.length === 0 ? (
          <EmptyState
            icon={<Recycle className="h-6 w-6" />}
            title={t('No recommendations yet')}
            body={t('Add products with their materials and log a few sales. Tokuma will rank the material switches that raise your circularity the most.')}
          />
        ) : (
          <EmptyState icon={<Recycle className="h-6 w-6" />} title={t('Fully circular')} body={t('Every material in your catalog is recycled or reused. Nothing left to switch.')} />
        )}
      </Card>
    );
  const idx = Math.min(i, recs.length - 1);
  const r: Recommendation = recs[idx]!;
  const bars = [
    { name: t('Current'), value: +r.current.toFixed(1) },
    { name: t('Projected'), value: +r.projected.toFixed(1) },
  ];
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title={t('Strategy recommendations')}
        sub={t('Ranked by projected gain on your last-90-day sales mix · {n} of {total}', { n: idx + 1, total: recs.length })}
        right={
          <div className="flex gap-1">
            <button className="icon-btn h-8 w-8" disabled={idx === 0} onClick={() => setI(idx - 1)} aria-label={t('Previous')}>
              <ChevronLeft className="h-4 w-4 rtl:-scale-x-100" />
            </button>
            <button className="icon-btn h-8 w-8" disabled={idx === recs.length - 1} onClick={() => setI(idx + 1)} aria-label={t('Next')}>
              <ChevronRight className="h-4 w-4 rtl:-scale-x-100" />
            </button>
          </div>
        }
      />
      <div key={r.productId + r.materialName} className="flex flex-1 animate-page-in flex-col px-5 pb-5 pt-4">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">#{idx + 1}</span>
          <div>
            <p className="font-semibold">{t('Switch {material} → recycled', { material: r.materialName.toLowerCase() })}</p>
            <p className="muted text-sm">
              {t('In {product}. {kg} of this input was sold in the last 90 days.', { product: r.productName, kg: fmtKg(r.kg) })}
            </p>
          </div>
        </div>
        <div className="mt-4 h-[120px]" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bars} layout="vertical" margin={{ left: 0, right: 40, top: 0, bottom: 0 }} barCategoryGap={10}>
              <XAxis type="number" domain={[0, 100]} hide />
              <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={72} tick={{ fontSize: 12, fill: c.axis }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} animationDuration={800} label={{ position: 'right', fontSize: 12, fontWeight: 600, fill: theme === 'dark' ? '#E5E7EB' : '#111827', formatter: (v: number) => fmtPct(v) }}>
                <Cell fill={c.tertiary} />
                <Cell fill={c.primary} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-auto flex items-center justify-between gap-3 pt-3">
          <Badge tone="green">{t('+{n} pts circularity', { n: fmtNum(r.gain) })}</Badge>
          {role === 'business' && (
            <button className="btn-primary btn-sm" onClick={() => applyMaterialSwitch(r.productId, r.materialName)}>
              <Wand2 className="h-3.5 w-3.5" /> {t('Apply to product')}
            </button>
          )}
        </div>
        <div className="mt-3 flex justify-center gap-1.5">
          {recs.map((_, j) => (
            <button key={j} onClick={() => setI(j)} className={clsx('h-1.5 rounded-full transition-all', j === idx ? 'w-5 bg-brand-600 dark:bg-brand-400' : 'w-1.5 bg-gray-300 dark:bg-white/20')} aria-label={t('Recommendation {n}', { n: j + 1 })} />
          ))}
        </div>
      </div>
    </Card>
  );
}

export default function Circularity() {
  const t = useT();
  const { lang } = useLang();
  const { circ30, circPrev30, products, ledger, theme } = useStore();
  const c = useChartColors(theme);
  const ready = useSimulatedLoad('circularity');
  const [compView, setCompView] = useState<'material' | 'class'>('material');
  const [drill, setDrill] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- labels follow the language
  const trend = useMemo(() => buildSeries(ledger, products, lastNDays(365)), [ledger, products, lang]);
  const classColor: Record<MaterialClass, string> = { Recycled: c.primary, Reused: c.secondary, Virgin: c.tertiary };

  const composition =
    compView === 'material'
      ? circ30.byMaterial.map((m) => ({ name: m.name, kg: +m.kg.toFixed(1), cls: m.cls }))
      : (['Recycled', 'Reused', 'Virgin'] as MaterialClass[]).map((k) => ({ name: t(k), kg: +circ30.byClass[k].toFixed(1), cls: k }));

  const drillProduct = products.find((p) => p.id === drill);

  const tiles = [
    // Deltas are null (hidden) unless both periods have real sales to compare.
    { label: t('Circularity rate'), value: circ30.hasData ? circ30.rate : null, fmt: (n: number) => fmtPct(n), delta: circ30.hasData && circPrev30.hasData ? circ30.rate - circPrev30.rate : null, icon: Recycle, suffix: ` ${t('pts')}` },
    { label: t('Total circular weight'), value: circ30.hasData ? circ30.circularKg : null, fmt: fmtKg, delta: circPrev30.circularKg ? ((circ30.circularKg - circPrev30.circularKg) / circPrev30.circularKg) * 100 : null, icon: Leaf, suffix: '%' },
    { label: t('Virgin material use'), value: circ30.hasData ? circ30.virginKg : null, fmt: fmtKg, delta: circPrev30.virginKg ? ((circ30.virginKg - circPrev30.virginKg) / circPrev30.virginKg) * 100 : null, icon: Scale, suffix: '%', invert: true },
    { label: t('Products tracked'), value: products.length, fmt: (n: number) => fmtInt(n), delta: null, icon: Package, suffix: '' },
  ];

  return (
    <>
      <PageHeader title={t('Circularity metrics')} sub={t("Calculated live from logged sales × each product's bill of materials (last 30 days)")}>
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-brand-200/60 bg-brand-50/60 px-3 py-2 text-xs text-brand-800 dark:border-brand-500/20 dark:bg-brand-500/[0.06] dark:text-brand-200">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {t("Circularity rate = weight of recycled + reused material in units sold ÷ total material weight sold. Edit a product's materials or log a sale and every number here updates.")}
          </span>
        </div>
      </PageHeader>
      {!ready ? (
        <div className="grid grid-cols-12 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} className="col-span-6 h-[120px] lg:col-span-3" lines={2} />
          ))}
          <CardSkeleton chart className="col-span-12 h-[360px] lg:col-span-7" />
          <CardSkeleton chart className="col-span-12 h-[360px] lg:col-span-5" />
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-5">
          {tiles.map((x) => (
            <Card key={x.label} className="col-span-6 p-5 lg:col-span-3">
              <p className="muted flex items-center gap-1.5 text-xs">
                <x.icon className="h-3.5 w-3.5" /> {x.label}
              </p>
              <AnimatedNumber value={x.value} format={x.fmt} className="mt-2 block text-[26px] font-bold leading-none" />
              {x.delta !== null && (
                <div className="mt-2 flex items-center gap-1.5">
                  <Delta value={x.delta} suffix={x.suffix} invert={x.invert} />
                  <span className="muted text-[11px]">{t('vs prior 30d')}</span>
                </div>
              )}
            </Card>
          ))}

          <Card className="col-span-12 lg:col-span-7">
            <CardHeader
              title={t('Material composition')}
              sub={t('Weight sold, last 30 days')}
              right={<Segmented value={compView} onChange={setCompView} options={[{ value: 'material', label: t('By material') }, { value: 'class', label: t('By type') }]} />}
            />
            <div className="flex gap-4 px-5 pt-3">
              {(['Recycled', 'Reused', 'Virgin'] as MaterialClass[]).map((k) => (
                <LegendItem key={k} color={classColor[k]} label={t(k)} />
              ))}
            </div>
            <div className="h-[320px] px-2 pb-3 pt-2" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={composition} layout="vertical" margin={{ left: 8, right: 48, top: 4, bottom: 4 }} barCategoryGap={6}>
                  <CartesianGrid horizontal={false} stroke={c.grid} />
                  <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: c.axis }} tickFormatter={(v) => `${v}kg`} />
                  <YAxis type="category" dataKey="name" interval={0} tickLine={false} axisLine={false} width={170} tick={{ fontSize: 12, fill: c.axis }} />
                  <Tooltip
                    cursor={{ fill: theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]!.payload as (typeof composition)[number];
                      return <TooltipBox title={d.name} rows={[{ color: classColor[d.cls], label: t(d.cls), value: fmtKg(d.kg) }, { color: classColor[d.cls], label: t('Share'), value: fmtPct((d.kg / circ30.totalKg) * 100) }]} />;
                    }}
                  />
                  <Bar dataKey="kg" radius={[0, 4, 4, 0]} animationDuration={800} label={{ position: 'right', fontSize: 11, fill: c.axis, formatter: (v: number) => `${v}` }}>
                    {composition.map((d) => (
                      <Cell key={d.name} fill={classColor[d.cls]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="col-span-12 lg:col-span-5">
            <RecommendationCarousel />
          </div>

          <Card className="col-span-12 lg:col-span-7">
            <CardHeader title={t('Circularity trend')} sub={t('Weekly, trailing 12 months — shifts with product mix and material changes')} />
            <div className="h-[260px] px-2 pb-3 pt-4" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={c.grid} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: c.axis }} minTickGap={28} />
                  <YAxis domain={['dataMin - 3', 'dataMax + 3']} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: c.axis }} tickFormatter={(v) => `${Math.round(v)}%`} width={40} />
                  <ReferenceLine y={65} stroke={c.neutral} strokeDasharray="4 4" label={{ value: t('Leader {pct}', { pct: fmtPct(65, 0) }), position: 'insideTopLeft', fontSize: 10, fill: c.axis }} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]!.payload as (typeof trend)[number];
                      return <TooltipBox title={t('Week of {date}', { date: d.label })} rows={[{ color: c.primary, label: t('Circularity'), value: fmtPct(d.circularity) }]} />;
                    }}
                  />
                  <Line type="monotone" dataKey="circularity" stroke={c.primary} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: c.surface, strokeWidth: 2 }} animationDuration={900} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="col-span-12 lg:col-span-5">
            <CardHeader title={t('Product circularity ranking')} sub={t('Click a product for its material breakdown')} />
            <ul className="space-y-1 p-3">
              {circ30.byProduct.length === 0 && <li className="muted px-2 py-8 text-center text-sm">{t('Products you add will be ranked here by circularity.')}</li>}
              {circ30.byProduct.map((p, i) => (
                <li key={p.id}>
                  <button onClick={() => setDrill(p.id)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-start transition hover:bg-gray-50 dark:hover:bg-white/[0.03]">
                    <span className="w-5 text-center text-xs font-semibold text-gray-400">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
                        <span className="block h-full rounded-full bg-brand-600 transition-all duration-700 dark:bg-brand-400" style={{ width: `${p.score}%` }} />
                      </span>
                    </span>
                    <span className="w-12 text-end text-sm font-semibold tabular-nums">{fmtPct(p.score, 0)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
      <Modal open={!!drillProduct} onClose={() => setDrill(null)} title={drillProduct?.name ?? ''} sub={t('Material breakdown per unit')}>
        {drillProduct && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Ring value={drillProduct.circularityScore} size={64} stroke={7} />
              <div>
                <p className="font-semibold">{t('{pct} circular by weight', { pct: fmtPct(drillProduct.circularityScore, 0) })}</p>
                <p className="muted text-sm">{t('{count} units sold in the last 30 days', { count: circ30.byProduct.find((x) => x.id === drillProduct.id)?.units ?? 0 })}</p>
              </div>
            </div>
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th ps-0">{t('Material')}</th>
                  <th className="th">{t('Type')}</th>
                  <th className="th text-end">{t('Weight')}</th>
                </tr>
              </thead>
              <tbody>
                {drillProduct.materials.map((m) => (
                  <tr key={m.name} className="tr">
                    <td className="td ps-0">{m.name}</td>
                    <td className="td">
                      <Badge tone={m.reused ? 'blue' : m.recycled ? 'green' : 'gray'}>{m.reused ? t('Reused') : m.recycled ? t('Recycled') : t('Virgin')}</Badge>
                    </td>
                    <td className="td text-end tabular-nums">{fmtKg(m.weightKg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </>
  );
}
