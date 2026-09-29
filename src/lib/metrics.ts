import type {
  Customer,
  CustomerStats,
  Insight,
  Material,
  MaterialClass,
  Product,
  Supplier,
  Transaction,
} from '../types';
import { addDays, clamp, daysBetween, fmtMoney, fmtMonth, fmtShortDate, parseISO, startOfToday, toISO } from './format';

/* ------------------------------------------------------------------ */
/* Materials & circularity                                             */
/* ------------------------------------------------------------------ */

export function classifyMaterial(m: Material): MaterialClass {
  if (m.reused) return 'Reused';
  if (m.recycled) return 'Recycled';
  return 'Virgin';
}

export const isCircular = (m: Material) => m.recycled || m.reused;

export function productWeight(p: { materials: Material[] }) {
  return p.materials.reduce((s, m) => s + m.weightKg, 0);
}

/** Share (0-100) of a product's weight that comes from recycled or reused material. */
export function materialCircularity(materials: Material[]) {
  const total = materials.reduce((s, m) => s + m.weightKg, 0);
  if (!total) return 0;
  const circ = materials.filter(isCircular).reduce((s, m) => s + m.weightKg, 0);
  return Math.round((circ / total) * 100);
}

/* ------------------------------------------------------------------ */
/* Daily ledger — one pass over transactions, reused by every chart    */
/* ------------------------------------------------------------------ */

export interface DayEntry {
  revenue: number;
  outflow: number;
  otherInflow: number;
  byProduct: Record<string, { revenue: number; units: number }>;
}

export type Ledger = Map<string, DayEntry>;

const WEEKLY_CATEGORIES = new Set(['Materials', 'Logistics']);
const MONTHLY_CATEGORIES = new Set(['Payroll', 'Rent & utilities', 'Marketing', 'Packaging']);
/** Financing inflows are excluded from profit so a grant or loan doesn't read as a sales spike. */
const FINANCING_CATEGORIES = new Set(['Grant', 'Loan', 'Equity']);

function entry(ledger: Ledger, iso: string) {
  let e = ledger.get(iso);
  if (!e) {
    e = { revenue: 0, outflow: 0, otherInflow: 0, byProduct: {} };
    ledger.set(iso, e);
  }
  return e;
}

/**
 * Builds an accrual-style daily ledger: recurring costs are spread over the
 * period they cover so daily/weekly profit isn't dominated by payment dates.
 */
export function buildLedger(txs: Transaction[]): Ledger {
  const ledger: Ledger = new Map();
  for (const t of txs) {
    if (t.type === 'inflow') {
      const e = entry(ledger, t.date);
      if (t.productId) {
        const bp = (e.byProduct[t.productId] ??= { revenue: 0, units: 0 });
        bp.revenue += t.amount;
        bp.units += t.quantity ?? 1;
        e.revenue += t.amount;
      } else if (!FINANCING_CATEGORIES.has(t.category)) {
        e.otherInflow += t.amount;
      }
      continue;
    }
    const d = parseISO(t.date);
    let span = 1;
    if (WEEKLY_CATEGORIES.has(t.category)) span = 7;
    else if (MONTHLY_CATEGORIES.has(t.category)) span = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const start = MONTHLY_CATEGORIES.has(t.category) ? new Date(d.getFullYear(), d.getMonth(), 1) : d;
    const per = t.amount / span;
    for (let i = 0; i < span; i++) entry(ledger, toISO(addDays(start, i))).outflow += per;
  }
  return ledger;
}

export interface Window {
  from: Date;
  to: Date; // inclusive
}

export function lastNDays(n: number, offset = 0, today = startOfToday()): Window {
  const to = addDays(today, -offset);
  return { from: addDays(to, -(n - 1)), to };
}

function* daysIn(w: Window) {
  for (let d = new Date(w.from); d <= w.to; d = addDays(d, 1)) yield toISO(d);
}

export interface Totals {
  revenue: number;
  outflow: number;
  profit: number;
  units: Record<string, number>;
}

/** Revenue/profit totals for a window, optionally restricted to a set of products. */
export function totalsFor(ledger: Ledger, w: Window, productFilter?: Set<string> | null): Totals {
  let revenue = 0;
  let outflow = 0;
  let other = 0;
  const units: Record<string, number> = {};
  for (const iso of daysIn(w)) {
    const e = ledger.get(iso);
    if (!e) continue;
    let dayRev = 0;
    for (const [pid, v] of Object.entries(e.byProduct)) {
      if (productFilter && !productFilter.has(pid)) continue;
      dayRev += v.revenue;
      units[pid] = (units[pid] ?? 0) + v.units;
    }
    const share = productFilter ? (e.revenue ? dayRev / e.revenue : 0) : 1;
    revenue += dayRev;
    outflow += e.outflow * share;
    if (!productFilter) other += e.otherInflow;
  }
  return { revenue, outflow, profit: revenue + other - outflow, units };
}

export interface CircularityStats {
  rate: number; // 0-100
  totalKg: number;
  circularKg: number;
  virginKg: number;
  byClass: Record<MaterialClass, number>;
  byMaterial: { name: string; cls: MaterialClass; kg: number }[];
  byProduct: { id: string; name: string; score: number; kg: number; units: number }[];
}

/**
 * Circularity computed from what was actually sold: units per product (from
 * transactions) × that product's material bill. Falls back to one unit of each
 * catalog product when there are no sales in the window, so it never sits at 0%.
 */
export function circularityFrom(products: Product[], units: Record<string, number>): CircularityStats {
  const byClass: Record<MaterialClass, number> = { Recycled: 0, Reused: 0, Virgin: 0 };
  const byMat = new Map<string, { name: string; cls: MaterialClass; kg: number }>();
  const hasSales = Object.values(units).some((u) => u > 0);
  const byProduct: CircularityStats['byProduct'] = [];
  for (const p of products) {
    const u = hasSales ? units[p.id] ?? 0 : 1;
    const kg = productWeight(p) * u;
    byProduct.push({ id: p.id, name: p.name, score: materialCircularity(p.materials), kg, units: u });
    if (!u) continue;
    for (const m of p.materials) {
      const cls = classifyMaterial(m);
      const w = m.weightKg * u;
      byClass[cls] += w;
      const key = `${m.name}|${cls}`;
      const cur = byMat.get(key) ?? { name: m.name, cls, kg: 0 };
      cur.kg += w;
      byMat.set(key, cur);
    }
  }
  const totalKg = byClass.Recycled + byClass.Reused + byClass.Virgin;
  const circularKg = byClass.Recycled + byClass.Reused;
  return {
    rate: totalKg ? (circularKg / totalKg) * 100 : 0,
    totalKg,
    circularKg,
    virginKg: byClass.Virgin,
    byClass,
    byMaterial: [...byMat.values()].sort((a, b) => b.kg - a.kg),
    byProduct: byProduct.sort((a, b) => b.score - a.score),
  };
}

export const pctChange = (cur: number, prev: number) => (prev ? ((cur - prev) / Math.abs(prev)) * 100 : 0);

/* ------------------------------------------------------------------ */
/* Time series for charts                                              */
/* ------------------------------------------------------------------ */

export type RangeKey = '30D' | '90D' | 'YTD' | '12M' | 'Custom';

export interface SeriesPoint {
  key: string;
  label: string;
  from: string;
  to: string;
  revenue: number;
  profit: number;
  /** null when the prior period falls before the first recorded transaction */
  prevRevenue: number | null;
  prevProfit: number | null;
  circularity: number;
}

export function rangeWindow(range: RangeKey, custom?: { from: string; to: string }, today = startOfToday()): Window {
  switch (range) {
    case '30D':
      return lastNDays(30, 0, today);
    case '90D':
      return lastNDays(90, 0, today);
    case 'YTD':
      return { from: new Date(today.getFullYear(), 0, 1), to: today };
    case '12M':
      return lastNDays(365, 0, today);
    case 'Custom': {
      if (custom?.from && custom?.to) {
        const a = parseISO(custom.from);
        const b = parseISO(custom.to);
        return a <= b ? { from: a, to: b } : { from: b, to: a };
      }
      return lastNDays(90, 0, today);
    }
  }
}

export function granularityFor(w: Window): 'day' | 'week' | 'month' {
  const days = daysBetween(w.from, w.to) + 1;
  if (days <= 45) return 'day';
  if (days <= 400) return 'week';
  return 'month';
}

export function ledgerStart(ledger: Ledger) {
  let min: string | null = null;
  for (const k of ledger.keys()) if (!min || k < min) min = k;
  return min;
}

export function buildSeries(ledger: Ledger, products: Product[], w: Window, productFilter?: Set<string> | null): SeriesPoint[] {
  const g = granularityFor(w);
  const first = ledgerStart(ledger);
  const len = daysBetween(w.from, w.to) + 1;
  const buckets: Window[] = [];
  if (g === 'month') {
    let cur = new Date(w.from);
    while (cur <= w.to) {
      let end = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
      if (end > w.to) end = w.to;
      buckets.push({ from: cur, to: end });
      cur = addDays(end, 1);
    }
  } else {
    // Anchor day/week buckets on the window end so the latest bucket is always complete.
    const step = g === 'day' ? 1 : 7;
    for (let end = new Date(w.to); end >= w.from; end = addDays(end, -step)) {
      const from = addDays(end, -(step - 1));
      if (from < w.from && buckets.length) break; // drop a partial leading week
      buckets.unshift({ from: from < w.from ? w.from : from, to: end });
    }
  }
  return buckets.map((b) => {
    const t = totalsFor(ledger, b, productFilter);
    const prevFrom = addDays(b.from, -len);
    const hasPrev = !!first && toISO(prevFrom) >= first;
    const prev = totalsFor(ledger, { from: prevFrom, to: addDays(b.to, -len) }, productFilter);
    const circ = circularityFrom(productFilter ? products.filter((p) => productFilter.has(p.id)) : products, t.units);
    return {
      key: toISO(b.from),
      label: g === 'month' ? fmtMonth(b.from) : fmtShortDate(b.from),
      from: toISO(b.from),
      to: toISO(b.to),
      revenue: Math.round(t.revenue),
      profit: Math.round(t.profit),
      prevRevenue: hasPrev ? Math.round(prev.revenue) : null,
      prevProfit: hasPrev ? Math.round(prev.profit) : null,
      circularity: +circ.rate.toFixed(1),
    };
  });
}

/* ------------------------------------------------------------------ */
/* Inventory — Focus 4                                                 */
/* ------------------------------------------------------------------ */

export function avgDailySales(ledger: Ledger, productId: string, days = 30, today = startOfToday()) {
  const t = totalsFor(ledger, lastNDays(days, 0, today), new Set([productId]));
  return (t.units[productId] ?? 0) / days;
}

export type StockStatus = 'critical' | 'reorder' | 'healthy';

export interface InventoryRow {
  product: Product;
  supplier?: Supplier;
  avgDaily: number;
  leadTime: number;
  reorderPoint: number;
  daysOfCover: number;
  status: StockStatus;
  suggestedOrder: number;
}

export const DEFAULT_LEAD_TIME = 14;

/** reorderPoint = (avgDailySales × supplierLeadTime) + safetyStock */
export function reorderPoint(avgDaily: number, leadTime: number, safetyStock: number) {
  return Math.ceil(avgDaily * leadTime + safetyStock);
}

export function inventoryRows(products: Product[], suppliers: Supplier[], ledger: Ledger): InventoryRow[] {
  return products.map((p) => {
    const supplier = suppliers.find((s) => s.id === p.supplierId);
    const leadTime = supplier?.avgLeadTimeDays ?? DEFAULT_LEAD_TIME;
    const avgDaily = avgDailySales(ledger, p.id);
    const rop = reorderPoint(avgDaily, leadTime, p.safetyStock);
    const status: StockStatus = p.stockOnHand <= p.lowStockThreshold ? 'critical' : p.stockOnHand <= rop ? 'reorder' : 'healthy';
    const daysOfCover = avgDaily ? p.stockOnHand / avgDaily : Infinity;
    // Order enough to cover lead time + 30 days of demand + safety stock.
    const target = Math.ceil(avgDaily * (leadTime + 30) + p.safetyStock);
    return { product: p, supplier, avgDaily, leadTime, reorderPoint: rop, daysOfCover, status, suggestedOrder: Math.max(0, target - p.stockOnHand) };
  });
}

/* ------------------------------------------------------------------ */
/* Supplier reliability — Focus 5                                      */
/* ------------------------------------------------------------------ */

/** 100 at ≤5 days, falling linearly to 0 at ≥45 days. */
export const leadTimeScore = (days: number) => clamp(((45 - days) / 40) * 100, 0, 100);

/** Each recognised certification is worth 35 points, capped at 100. */
export const certificationScore = (certs: string[]) => clamp(certs.length * 35, 0, 100);

/** Reliability = 0.3 × leadTimeScore + 0.5 × onTimeDelivery + 0.2 × certificationScore */
export function reliabilityScore(s: Pick<Supplier, 'avgLeadTimeDays' | 'onTimeDeliveryRate' | 'certifications'>) {
  return Math.round(0.3 * leadTimeScore(s.avgLeadTimeDays) + 0.5 * s.onTimeDeliveryRate + 0.2 * certificationScore(s.certifications));
}

export function riskLevel(score: number): 'Low' | 'Moderate' | 'High' {
  if (score >= 80) return 'Low';
  if (score >= 65) return 'Moderate';
  return 'High';
}

/** kg CO₂e per tonne-km by transport mode (simplified factors). */
export const TRANSPORT_FACTOR: Record<string, number> = { Sea: 0.016, Rail: 0.028, Road: 0.105, Air: 0.602 };

/* ------------------------------------------------------------------ */
/* Customers                                                           */
/* ------------------------------------------------------------------ */

export function customerStats(customers: Customer[], txs: Transaction[], today = startOfToday()): CustomerStats[] {
  const agg = new Map<string, { total: number; orders: Set<string>; last: string | null; products: Set<string> }>();
  for (const t of txs) {
    if (t.type !== 'inflow' || !t.customerId) continue;
    const a = agg.get(t.customerId) ?? { total: 0, orders: new Set(), last: null, products: new Set() };
    a.total += t.amount;
    a.orders.add(t.date); // same-day purchases count as one order
    if (!a.last || t.date > a.last) a.last = t.date;
    if (t.productId) a.products.add(t.productId);
    agg.set(t.customerId, a);
  }
  return customers.map((c) => {
    const a = agg.get(c.id);
    const orders = a?.orders.size ?? 0;
    const last = a?.last ?? null;
    const recency = last ? daysBetween(parseISO(last), today) : Infinity;
    const segment: CustomerStats['segment'] = recency > 90 ? 'At-risk' : orders > 1 && daysBetween(parseISO(c.joinedDate), today) > 60 ? 'Repeat' : 'New';
    return {
      ...c,
      totalSpent: a?.total ?? 0,
      lastOrderDate: last,
      orders,
      productsPurchased: a ? [...a.products] : [],
      segment,
      avgOrderValue: orders ? (a!.total / orders) : 0,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Funding                                                             */
/* ------------------------------------------------------------------ */

export interface FundingTerms {
  score: number;
  maxEligibility: number;
  apr: number;
  annualRevenue: number;
}

export function fundingTerms(circularityRate: number, annualRevenue: number, avgSustainability: number, margin: number): FundingTerms {
  const marginScore = clamp(margin * 250, 0, 100); // 40% margin → 100
  const score = Math.round(0.5 * circularityRate + 0.3 * avgSustainability + 0.2 * marginScore);
  const maxEligibility = Math.round((annualRevenue * (0.12 + (0.3 * circularityRate) / 100)) / 500) * 500;
  const apr = +clamp(12.5 - 0.07 * circularityRate - 0.025 * (avgSustainability - 50), 4.5, 14).toFixed(2);
  return { score, maxEligibility, apr, annualRevenue };
}

/* ------------------------------------------------------------------ */
/* Milestones                                                          */
/* ------------------------------------------------------------------ */

export interface MilestoneStage {
  name: string;
  min: number;
  criteria: { label: string; met: boolean }[];
}

export function milestoneStages(ctx: { rate: number; suppliers: number; products: number; avgReliability: number; historyDays: number }): MilestoneStage[] {
  return [
    {
      name: 'Circular Starter',
      min: 0,
      criteria: [
        { label: 'Business profile completed', met: true },
        { label: 'At least 1 product with materials logged', met: ctx.products >= 1 },
      ],
    },
    {
      name: 'Circular Grower',
      min: 40,
      criteria: [
        { label: 'Circularity rate ≥ 40%', met: ctx.rate >= 40 },
        { label: '3+ suppliers tracked', met: ctx.suppliers >= 3 },
        { label: '90+ days of transactions', met: ctx.historyDays >= 90 },
      ],
    },
    {
      name: 'Circular Leader',
      min: 65,
      criteria: [
        { label: 'Circularity rate ≥ 65%', met: ctx.rate >= 65 },
        { label: 'Avg supplier reliability ≥ 80', met: ctx.avgReliability >= 80 },
        { label: '5+ products tracked', met: ctx.products >= 5 },
      ],
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Recommendations & insights                                          */
/* ------------------------------------------------------------------ */

export interface Recommendation {
  productId: string;
  productName: string;
  materialName: string;
  kg: number;
  current: number;
  projected: number;
  gain: number;
}

/** Rank virgin materials by how much switching them to a recycled source lifts the overall rate. */
export function recommendations(products: Product[], units: Record<string, number>, limit = 3): Recommendation[] {
  const base = circularityFrom(products, units).rate;
  const recs: Recommendation[] = [];
  for (const p of products) {
    p.materials.forEach((m, i) => {
      if (isCircular(m)) return;
      const swapped = products.map((q) =>
        q.id === p.id ? { ...q, materials: q.materials.map((mm, j) => (j === i ? { ...mm, recycled: true } : mm)) } : q,
      );
      const projected = circularityFrom(swapped, units).rate;
      recs.push({
        productId: p.id,
        productName: p.name,
        materialName: m.name,
        kg: m.weightKg * (units[p.id] ?? 0),
        current: base,
        projected,
        gain: projected - base,
      });
    });
  }
  return recs.sort((a, b) => b.gain - a.gain).slice(0, limit);
}

export function generateInsights(ctx: {
  inventory: InventoryRow[];
  suppliers: Supplier[];
  recs: Recommendation[];
  funding: FundingTerms;
  customers: CustomerStats[];
  peakLift: number;
}): Insight[] {
  const out: Insight[] = [];
  for (const r of ctx.inventory.filter((i) => i.status !== 'healthy')) {
    const lost = Math.round(r.avgDaily * r.leadTime * r.product.price);
    out.push({
      id: `ins_stock_${r.product.id}`,
      kind: 'alert',
      title: `${r.product.name} ${r.status === 'critical' ? 'is below its low-stock threshold' : 'has hit its reorder point'}`,
      body: `${r.product.stockOnHand} units on hand ≈ ${Number.isFinite(r.daysOfCover) ? Math.floor(r.daysOfCover) : '∞'} days of cover, but ${r.supplier?.name ?? 'the supplier'} needs ${r.leadTime} days to deliver. Suggested order: ${r.suggestedOrder} units.`,
      impact: `Protects ~${fmtMoney(lost)} in sales`,
      confidence: 'High',
      actionLabel: 'Open inventory',
      action: { type: 'navigate', to: '/app/products/inventory' },
    });
  }
  ctx.recs.slice(0, 2).forEach((rec, i) => {
    out.push({
      id: `ins_mat_${rec.productId}_${rec.materialName}`,
      kind: 'optimization',
      title: `Switch ${rec.materialName.toLowerCase()} to a recycled source`,
      body: `${rec.materialName} in ${rec.productName} is your ${i === 0 ? 'largest' : 'next-largest'} virgin input by sold weight (${rec.kg.toFixed(0)} kg last 90 days).`,
      impact: `+${rec.gain.toFixed(1)}% circularity`,
      confidence: i === 0 ? 'High' : 'Medium',
      actionLabel: 'Apply change',
      action: { type: 'apply-material', productId: rec.productId, materialName: rec.materialName },
    });
  });
  const weak = [...ctx.suppliers].map((s) => ({ s, score: reliabilityScore(s) })).sort((a, b) => a.score - b.score)[0];
  if (weak && weak.score < 75) {
    out.push({
      id: `ins_sup_${weak.s.id}`,
      kind: 'alert',
      title: `${weak.s.name} reliability is ${weak.score}/100`,
      body: `${weak.s.onTimeDeliveryRate}% on-time with a ${weak.s.avgLeadTimeDays}-day lead time via ${weak.s.transportMethod.toLowerCase()}. Linked products carry higher reorder points as a result.`,
      impact: 'Reduce stock-out risk',
      confidence: 'Medium',
      actionLabel: 'Review supplier',
      action: { type: 'navigate', to: '/app/supply-chain/reliability' },
    });
  }
  out.push({
    id: 'ins_funding',
    kind: 'opportunity',
    title: `You qualify for up to ${fmtMoney(ctx.funding.maxEligibility)}`,
    body: `Your circularity and supplier data unlock an estimated ${ctx.funding.apr.toFixed(2)}% APR — below the small-business average.`,
    impact: `Score ${ctx.funding.score}/100`,
    confidence: 'High',
    actionLabel: 'View funding',
    action: { type: 'navigate', to: '/app/funding' },
  });
  const atRisk = ctx.customers.filter((c) => c.segment === 'At-risk');
  if (atRisk.length) {
    out.push({
      id: 'ins_customers',
      kind: 'opportunity',
      title: `Win back ${atRisk.length} at-risk customers`,
      body: `They've spent ${fmtMoney(atRisk.reduce((s, c) => s + c.totalSpent, 0))} with you but haven't ordered in 90+ days. A take-back credit is a natural re-engagement hook.`,
      impact: 'Retention',
      confidence: 'Medium',
      actionLabel: 'See customers',
      action: { type: 'navigate', to: '/app/customers' },
    });
  }
  if (ctx.peakLift > 10) {
    out.push({
      id: 'ins_season',
      kind: 'optimization',
      title: 'Holiday peak ahead — raise safety stock',
      body: `Last Nov–Dec revenue ran ${ctx.peakLift.toFixed(0)}% above your yearly average. Long-lead suppliers need orders placed 4–5 weeks ahead.`,
      impact: `+${ctx.peakLift.toFixed(0)}% seasonal demand`,
      confidence: 'Medium',
      actionLabel: 'Plan inventory',
      action: { type: 'navigate', to: '/app/products/inventory' },
    });
  }
  return out;
}

/** How much a year-ago Nov–Dec outperformed the trailing-year monthly average. */
export function seasonalPeakLift(ledger: Ledger, today = startOfToday()) {
  const year = today.getMonth() >= 11 ? today.getFullYear() : today.getFullYear() - 1;
  const peak = totalsFor(ledger, { from: new Date(year, 10, 1), to: new Date(year, 11, 31) });
  const yr = totalsFor(ledger, lastNDays(365, 0, today));
  const avg2mo = (yr.revenue / 12) * 2;
  return avg2mo ? ((peak.revenue - avg2mo) / avg2mo) * 100 : 0;
}

export function historyDays(txs: Transaction[], today = startOfToday()) {
  let min: string | null = null;
  for (const t of txs) if (!min || t.date < min) min = t.date;
  return min ? daysBetween(parseISO(min), today) : 0;
}
