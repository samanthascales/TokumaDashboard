import { useMemo } from 'react';
import { DollarSign, FileText, Filter, Leaf, Recycle, TrendingUp, X } from 'lucide-react';
import { useStore } from '../store/AppStore';
import { addDays, fmtDate, fmtKg, fmtMoney, fmtPct, startOfToday, toISO } from '../lib/format';
import { circularityFrom, lastNDays, pctChange, totalsFor } from '../lib/metrics';
import { useSimulatedLoad } from '../lib/hooks';
import { CardSkeleton, PageHeader } from '../components/ui';
import { openReport } from '../components/layout/nav';
import { RevenueChart } from './dashboard/RevenueChart';
import { ActivityCard, GettingStarted, InsightsFeed, KpiCard, LowStockBanner, MaterialMix, MilestoneCard } from './dashboard/Widgets';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Dashboard() {
  const { ledger, products, filteredProductIds, materialFilter, setMaterialFilter, profile } = useStore();
  const ready = useSimulatedLoad('dashboard', 800);

  const kpis = useMemo(() => {
    const scoped = filteredProductIds ? products.filter((p) => filteredProductIds.has(p.id)) : products;
    const cur = totalsFor(ledger, lastNDays(30), filteredProductIds);
    const prev = totalsFor(ledger, lastNDays(30, 30), filteredProductIds);
    const cC = circularityFrom(scoped, cur.units);
    const cP = circularityFrom(scoped, prev.units);
    // 12 weekly points for sparklines
    const weeks = Array.from({ length: 12 }, (_, i) => {
      const w = lastNDays(7, (11 - i) * 7);
      const t = totalsFor(ledger, w, filteredProductIds);
      const c = circularityFrom(scoped, t.units);
      return { rev: t.revenue, profit: t.profit, rate: c.rate, kg: c.circularKg };
    });
    return { cur, prev, cC, cP, weeks };
  }, [ledger, products, filteredProductIds]);

  const firstName = profile.ownerName.trim().split(' ')[0];

  return (
    <>
      <PageHeader
        title={firstName ? `${greeting()}, ${firstName}` : greeting()}
        sub={`Here's how ${profile.businessName || 'your business'} is performing · ${fmtDate(toISO(addDays(startOfToday(), -29)))} – ${fmtDate(toISO(startOfToday()))}`}
        actions={
          <>
            {materialFilter && (
              <span className="inline-flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 py-1.5 pl-3 pr-1.5 text-xs font-medium text-brand-800 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200">
                <Filter className="h-3.5 w-3.5" />
                Products with {materialFilter.toLowerCase()} material
                <button className="rounded p-0.5 hover:bg-brand-100 dark:hover:bg-brand-500/20" onClick={() => setMaterialFilter(null)} aria-label="Clear filter">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            )}
            <button className="btn-primary" onClick={openReport}>
              <FileText className="h-4 w-4" /> Generate report
            </button>
          </>
        }
      />

      <LowStockBanner />
      <GettingStarted />

      <div className="grid grid-cols-12 gap-4 lg:gap-5">
        {!ready ? (
          <>
            {Array.from({ length: 4 }).map((_, i) => (
              <CardSkeleton key={i} className="col-span-12 h-[172px] sm:col-span-6 xl:col-span-3" lines={2} />
            ))}
            <CardSkeleton chart className="col-span-12 h-[440px] xl:col-span-8" />
            <CardSkeleton chart className="col-span-12 h-[440px] xl:col-span-4" />
            <CardSkeleton className="col-span-12 h-[300px] xl:col-span-8" lines={6} />
            <CardSkeleton className="col-span-12 h-[300px] xl:col-span-4" lines={6} />
          </>
        ) : (
          <>
            <div className="col-span-12 sm:col-span-6 xl:col-span-3">
              <KpiCard label="Monthly revenue" icon={<DollarSign className="h-3.5 w-3.5" />} value={kpis.cur.revenue} format={fmtMoney} delta={pctChange(kpis.cur.revenue, kpis.prev.revenue)} spark={kpis.weeks.map((w) => w.rev)} />
            </div>
            <div className="col-span-12 sm:col-span-6 xl:col-span-3">
              <KpiCard
                label="Circularity rate"
                icon={<Recycle className="h-3.5 w-3.5" />}
                value={kpis.cC.rate}
                format={(n) => fmtPct(n)}
                delta={kpis.cC.rate - kpis.cP.rate}
                hint="pts vs previous 30 days"
                spark={kpis.weeks.map((w) => w.rate)}
              />
            </div>
            <div className="col-span-12 sm:col-span-6 xl:col-span-3">
              <KpiCard label="Net profit" icon={<TrendingUp className="h-3.5 w-3.5" />} value={kpis.cur.profit} format={fmtMoney} delta={pctChange(kpis.cur.profit, kpis.prev.profit)} spark={kpis.weeks.map((w) => w.profit)} />
            </div>
            <div className="col-span-12 sm:col-span-6 xl:col-span-3">
              <KpiCard label="Material saved" icon={<Leaf className="h-3.5 w-3.5" />} value={kpis.cC.circularKg} format={fmtKg} delta={pctChange(kpis.cC.circularKg, kpis.cP.circularKg)} hint="recycled + reused, vs prior 30d" spark={kpis.weeks.map((w) => w.kg)} />
            </div>

            <div className="col-span-12 xl:col-span-8">
              <RevenueChart />
            </div>
            <div className="col-span-12 md:col-span-6 xl:col-span-4">
              <MaterialMix />
            </div>

            <div className="col-span-12 md:col-span-6 xl:col-span-4 xl:row-span-2">
              <InsightsFeed />
            </div>
            <div className="col-span-12 xl:col-span-8">
              <MilestoneCard />
            </div>
            <div className="col-span-12 xl:col-span-8">
              <ActivityCard />
            </div>
          </>
        )}
      </div>
    </>
  );
}
