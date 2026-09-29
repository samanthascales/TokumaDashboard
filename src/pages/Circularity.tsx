import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, Info, Leaf, Package, Recycle, Scale, Wand2 } from 'lucide-react';
import { useStore } from '../store/AppStore';
import { useChartColors, useSimulatedLoad } from '../lib/hooks';
import { fmtKg, fmtPct } from '../lib/format';
import { buildSeries, lastNDays, type Recommendation } from '../lib/metrics';
import { AnimatedNumber, Badge, Card, CardHeader, CardSkeleton, Delta, EmptyState, Modal, PageHeader, Ring, Segmented } from '../components/ui';
import { LegendItem, TooltipBox } from '../components/charts/ChartTooltip';
import type { MaterialClass } from '../types';

function RecommendationCarousel() {
  const { recs, applyMaterialSwitch, theme, role } = useStore();
  const c = useChartColors(theme);
  const [i, setI] = useState(0);
  if (!recs.length)
    return (
      <Card className="h-full">
        <CardHeader title="Strategy recommendations" />
        <EmptyState icon={<Recycle className="h-6 w-6" />} title="Fully circular" body="Every material in your catalog is recycled or reused. Nothing left to switch." />
      </Card>
    );
  const idx = Math.min(i, recs.length - 1);
  const r: Recommendation = recs[idx]!;
  const bars = [
    { name: 'Current', value: +r.current.toFixed(1) },
    { name: 'Projected', value: +r.projected.toFixed(1) },
  ];
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Strategy recommendations"
        sub={`Ranked by projected gain on your last-90-day sales mix · ${idx + 1} of ${recs.length}`}
        right={
          <div className="flex gap-1">
            <button className="icon-btn h-8 w-8" disabled={idx === 0} onClick={() => setI(idx - 1)} aria-label="Previous">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button className="icon-btn h-8 w-8" disabled={idx === recs.length - 1} onClick={() => setI(idx + 1)} aria-label="Next">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        }
      />
      <div key={r.productId + r.materialName} className="flex flex-1 animate-page-in flex-col px-5 pb-5 pt-4">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">#{idx + 1}</span>
          <div>
            <p className="font-semibold">Switch {r.materialName.toLowerCase()} → recycled</p>
            <p className="muted text-sm">
              In {r.productName}. {r.kg.toFixed(0)} kg of this input was sold in the last 90 days.
            </p>
          </div>
        </div>
        <div className="mt-4 h-[120px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bars} layout="vertical" margin={{ left: 0, right: 40, top: 0, bottom: 0 }} barCategoryGap={10}>
              <XAxis type="number" domain={[0, 100]} hide />
              <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={72} tick={{ fontSize: 12, fill: c.axis }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} animationDuration={800} label={{ position: 'right', fontSize: 12, fontWeight: 600, fill: theme === 'dark' ? '#E5E7EB' : '#111827', formatter: (v: number) => `${v}%` }}>
                <Cell fill={c.tertiary} />
                <Cell fill={c.primary} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-auto flex items-center justify-between gap-3 pt-3">
          <Badge tone="green">+{r.gain.toFixed(1)} pts circularity</Badge>
          {role === 'business' && (
            <button className="btn-primary btn-sm" onClick={() => applyMaterialSwitch(r.productId, r.materialName)}>
              <Wand2 className="h-3.5 w-3.5" /> Apply to product
            </button>
          )}
        </div>
        <div className="mt-3 flex justify-center gap-1.5">
          {recs.map((_, j) => (
            <button key={j} onClick={() => setI(j)} className={clsx('h-1.5 rounded-full transition-all', j === idx ? 'w-5 bg-brand-600 dark:bg-brand-400' : 'w-1.5 bg-gray-300 dark:bg-white/20')} aria-label={`Recommendation ${j + 1}`} />
          ))}
        </div>
      </div>
    </Card>
  );
}

export default function Circularity() {
  const { circ30, circPrev30, products, ledger, theme } = useStore();
  const c = useChartColors(theme);
  const ready = useSimulatedLoad('circularity');
  const [compView, setCompView] = useState<'material' | 'class'>('material');
  const [drill, setDrill] = useState<string | null>(null);
  const trend = useMemo(() => buildSeries(ledger, products, lastNDays(365)), [ledger, products]);
  const classColor: Record<MaterialClass, string> = { Recycled: c.primary, Reused: c.secondary, Virgin: c.tertiary };

  const composition =
    compView === 'material'
      ? circ30.byMaterial.map((m) => ({ name: m.name, kg: +m.kg.toFixed(1), cls: m.cls }))
      : (['Recycled', 'Reused', 'Virgin'] as MaterialClass[]).map((k) => ({ name: k, kg: +circ30.byClass[k].toFixed(1), cls: k }));

  const drillProduct = products.find((p) => p.id === drill);

  const tiles = [
    { label: 'Circularity rate', value: circ30.rate, fmt: (n: number) => fmtPct(n), delta: circ30.rate - circPrev30.rate, icon: Recycle, suffix: ' pts' },
    { label: 'Total circular weight', value: circ30.circularKg, fmt: fmtKg, delta: circPrev30.circularKg ? ((circ30.circularKg - circPrev30.circularKg) / circPrev30.circularKg) * 100 : 0, icon: Leaf, suffix: '%' },
    { label: 'Virgin material use', value: circ30.virginKg, fmt: fmtKg, delta: circPrev30.virginKg ? ((circ30.virginKg - circPrev30.virginKg) / circPrev30.virginKg) * 100 : 0, icon: Scale, suffix: '%', invert: true },
    { label: 'Products tracked', value: products.length, fmt: (n: number) => Math.round(n).toString(), delta: 0, icon: Package, suffix: '' },
  ];

  return (
    <>
      <PageHeader title="Circularity metrics" sub="Calculated live from logged sales × each product's bill of materials (last 30 days)">
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-brand-200/60 bg-brand-50/60 px-3 py-2 text-xs text-brand-800 dark:border-brand-500/20 dark:bg-brand-500/[0.06] dark:text-brand-200">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Circularity rate = weight of recycled + reused material in units sold ÷ total material weight sold. Edit a product's materials or log a sale and every number here updates.
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
          {tiles.map((t) => (
            <Card key={t.label} className="col-span-6 p-5 lg:col-span-3">
              <p className="muted flex items-center gap-1.5 text-xs">
                <t.icon className="h-3.5 w-3.5" /> {t.label}
              </p>
              <AnimatedNumber value={t.value} format={t.fmt} className="mt-2 block text-[26px] font-bold leading-none" />
              {t.suffix && (
                <div className="mt-2 flex items-center gap-1.5">
                  <Delta value={t.delta} suffix={t.suffix} invert={t.invert} />
                  <span className="muted text-[11px]">vs prior 30d</span>
                </div>
              )}
            </Card>
          ))}

          <Card className="col-span-12 lg:col-span-7">
            <CardHeader
              title="Material composition"
              sub="Weight sold, last 30 days"
              right={<Segmented value={compView} onChange={setCompView} options={[{ value: 'material', label: 'By material' }, { value: 'class', label: 'By type' }]} />}
            />
            <div className="flex gap-4 px-5 pt-3">
              {(['Recycled', 'Reused', 'Virgin'] as MaterialClass[]).map((k) => (
                <LegendItem key={k} color={classColor[k]} label={k} />
              ))}
            </div>
            <div className="h-[320px] px-2 pb-3 pt-2">
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
                      return <TooltipBox title={d.name} rows={[{ color: classColor[d.cls], label: d.cls, value: fmtKg(d.kg) }, { color: classColor[d.cls], label: 'Share', value: fmtPct((d.kg / circ30.totalKg) * 100) }]} />;
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
            <CardHeader title="Circularity trend" sub="Weekly, trailing 12 months — shifts with product mix and material changes" />
            <div className="h-[260px] px-2 pb-3 pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ left: 0, right: 16, top: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={c.grid} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: c.axis }} minTickGap={28} />
                  <YAxis domain={['dataMin - 3', 'dataMax + 3']} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: c.axis }} tickFormatter={(v) => `${Math.round(v)}%`} width={40} />
                  <ReferenceLine y={65} stroke={c.neutral} strokeDasharray="4 4" label={{ value: 'Leader 65%', position: 'insideTopLeft', fontSize: 10, fill: c.axis }} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]!.payload as (typeof trend)[number];
                      return <TooltipBox title={`Week of ${d.label}`} rows={[{ color: c.primary, label: 'Circularity', value: `${d.circularity}%` }]} />;
                    }}
                  />
                  <Line type="monotone" dataKey="circularity" stroke={c.primary} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: c.surface, strokeWidth: 2 }} animationDuration={900} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="col-span-12 lg:col-span-5">
            <CardHeader title="Product circularity ranking" sub="Click a product for its material breakdown" />
            <ul className="space-y-1 p-3">
              {circ30.byProduct.map((p, i) => (
                <li key={p.id}>
                  <button onClick={() => setDrill(p.id)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-gray-50 dark:hover:bg-white/[0.03]">
                    <span className="w-5 text-center text-xs font-semibold text-gray-400">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
                        <span className="block h-full rounded-full bg-brand-600 transition-all duration-700 dark:bg-brand-400" style={{ width: `${p.score}%` }} />
                      </span>
                    </span>
                    <span className="w-12 text-right text-sm font-semibold tabular-nums">{p.score}%</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
      <Modal open={!!drillProduct} onClose={() => setDrill(null)} title={drillProduct?.name ?? ''} sub="Material breakdown per unit">
        {drillProduct && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Ring value={drillProduct.circularityScore} size={64} stroke={7} />
              <div>
                <p className="font-semibold">{drillProduct.circularityScore}% circular by weight</p>
                <p className="muted text-sm">{circ30.byProduct.find((x) => x.id === drillProduct.id)?.units ?? 0} units sold in the last 30 days</p>
              </div>
            </div>
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th pl-0">Material</th>
                  <th className="th">Type</th>
                  <th className="th text-right">Weight</th>
                </tr>
              </thead>
              <tbody>
                {drillProduct.materials.map((m) => (
                  <tr key={m.name} className="tr">
                    <td className="td pl-0">{m.name}</td>
                    <td className="td">
                      <Badge tone={m.reused ? 'blue' : m.recycled ? 'green' : 'gray'}>{m.reused ? 'Reused' : m.recycled ? 'Recycled' : 'Virgin'}</Badge>
                    </td>
                    <td className="td text-right tabular-nums">{m.weightKg} kg</td>
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
