import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BadgeCheck, FileText, Landmark, Leaf, Recycle, ShieldCheck, TrendingUp } from 'lucide-react';
import { useStore } from '../store/AppStore';
import { useChartColors, useSimulatedLoad } from '../lib/hooks';
import { fmtCompactMoney, fmtKg, fmtMoney, fmtPct } from '../lib/format';
import { buildSeries, lastNDays, reliabilityScore, riskLevel, totalsFor } from '../lib/metrics';
import { AnimatedNumber, Badge, Card, CardHeader, CardSkeleton, Gauge, PageHeader } from '../components/ui';
import { TooltipBox } from '../components/charts/ChartTooltip';
import { openReport } from '../components/layout/nav';

export default function Investor() {
  const { profile, circ30, funding, suppliers, ledger, products, theme, fundingRequests } = useStore();
  const c = useChartColors(theme);
  const ready = useSimulatedLoad('investor');
  const series = useMemo(() => buildSeries(ledger, products, lastNDays(365)), [ledger, products]);
  const yr = useMemo(() => totalsFor(ledger, lastNDays(365)), [ledger]);
  const avgRel = suppliers.length ? Math.round(suppliers.reduce((s, x) => s + reliabilityScore(x), 0) / suppliers.length) : 0;
  const open = fundingRequests.find((r) => r.status === 'Pending');

  return (
    <>
      <PageHeader
        title={profile.businessName}
        sub={`${profile.industry} · ${profile.country} · ${profile.circularModel}`}
        actions={
          <button className="btn-primary" onClick={openReport}>
            <FileText className="h-4 w-4" /> Generate report
          </button>
        }
      >
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone="green">
            <BadgeCheck className="h-3 w-3" /> Verified circular business
          </Badge>
          <Badge>Founded {profile.founded}</Badge>
          <Badge>{profile.employees} people</Badge>
        </div>
      </PageHeader>
      {!ready ? (
        <div className="grid grid-cols-12 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} className="col-span-6 h-[120px] lg:col-span-3" lines={2} />
          ))}
          <CardSkeleton chart className="col-span-12 h-[340px] lg:col-span-8" />
          <CardSkeleton className="col-span-12 h-[340px] lg:col-span-4" />
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-5">
          {[
            { label: 'Trailing 12m revenue', v: yr.revenue, f: fmtMoney, icon: TrendingUp },
            { label: 'Net margin', v: yr.revenue ? (yr.profit / yr.revenue) * 100 : 0, f: (n: number) => fmtPct(n), icon: Landmark },
            { label: 'Circularity rate', v: circ30.rate, f: (n: number) => fmtPct(n), icon: Recycle },
            { label: 'Circular material (30d)', v: circ30.circularKg, f: fmtKg, icon: Leaf },
          ].map((k) => (
            <Card key={k.label} className="col-span-6 p-5 lg:col-span-3">
              <p className="muted flex items-center gap-1.5 text-xs">
                <k.icon className="h-3.5 w-3.5" /> {k.label}
              </p>
              <AnimatedNumber value={k.v} format={k.f} className="mt-2 block text-[26px] font-bold leading-none" />
            </Card>
          ))}
          <Card className="col-span-12 lg:col-span-8">
            <CardHeader title="Revenue trajectory" sub="Weekly, trailing 12 months" />
            <div className="h-[280px] px-2 pb-3 pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ left: 4, right: 16, top: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="invFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor={c.primary} stopOpacity={0.2} />
                      <stop offset="100%" stopColor={c.primary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={c.grid} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: c.axis }} minTickGap={28} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: c.axis }} tickFormatter={fmtCompactMoney} width={52} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]!.payload as (typeof series)[number];
                      return <TooltipBox title={`Week of ${d.label}`} rows={[{ color: c.primary, label: 'Revenue', value: fmtMoney(d.revenue) }, { color: c.primary, label: 'Circularity', value: `${d.circularity}%` }]} />;
                    }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke={c.primary} strokeWidth={2} fill="url(#invFill)" animationDuration={900} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="col-span-12 flex flex-col items-center p-6 text-center lg:col-span-4">
            <p className="card-title">Funding readiness</p>
            <div className="my-4">
              <Gauge value={funding.score} size={150} label="score" />
            </div>
            <div className="grid w-full grid-cols-2 gap-3 text-left">
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-white/[0.03]">
                <p className="muted text-xs">Max eligibility</p>
                <p className="num">{fmtMoney(funding.maxEligibility)}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-white/[0.03]">
                <p className="muted text-xs">Est. APR</p>
                <p className="num">{funding.apr.toFixed(2)}%</p>
              </div>
            </div>
            {open && (
              <p className="muted mt-4 text-xs">
                Open ask: <b className="text-gray-900 dark:text-white">{fmtMoney(open.amount)} {open.type.toLowerCase()}</b> — {open.purpose}
              </p>
            )}
          </Card>
          <Card className="col-span-12">
            <CardHeader title="Supply-chain risk" sub={`Average supplier reliability ${avgRel}/100`} right={<ShieldCheck className="h-4 w-4 text-gray-400" />} />
            <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-5">
              {suppliers.map((s) => {
                const sc = reliabilityScore(s);
                const r = riskLevel(sc);
                return (
                  <div key={s.id} className="rounded-lg border border-gray-100 p-3 dark:border-white/5">
                    <p className="truncate text-sm font-medium">{s.name}</p>
                    <p className="muted text-xs">{s.country}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="num text-lg">{sc}</span>
                      <Badge tone={r === 'Low' ? 'green' : r === 'Moderate' ? 'amber' : 'red'}>{r} risk</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
