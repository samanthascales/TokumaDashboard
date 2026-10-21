import type { Product, RecoveryRoute, WasteEntry } from '../types';
import type { CircularityStats } from './metrics';
import { clamp } from './format';

/**
 * The circularity score: Tokuma's version of the Circular Innovation Score
 * (CIS) from "Circularity Scoring: Research Basis for the Circular Innovation
 * Score" (Oct 14, 2026).
 *
 * Five pillars, each traceable to a published metric and scored 0–1:
 *   1. Circular inflow        WBCSD CTI % circular inflow; EMF MCI F_R + F_U + F_S
 *   2. Circular outflow       WBCSD CTI % circular outflow, weighted by R-ladder rung (Potting et al. 2017)
 *   3. Product life & utility EMF MCI utility factor X = L/L_av × U/U_av
 *   4. Resource productivity  WBCSD CTI circular material productivity (revenue ÷ linear inflow)
 *   5. Circular business model share of revenue from reuse, repair, resale, sharing, recycling (MSCI CE / CTI revenue)
 *
 * Assembled with the OECD/JRC composite-indicator method: equal weights (0.2
 * each) and geometric aggregation, CIS = 100 × Π P_k^w_k, so a weak pillar
 * pulls the score down instead of being averaged away. A linear aggregate is
 * reported beside it as the sensitivity band.
 *
 * Choices the research leaves open are marked DRAFT below; change them here.
 */
export const SCORE_VERSION = 'CIS 1.0';

export type PillarKey = 'inflow' | 'outflow' | 'life' | 'productivity' | 'businessModel';
export const PILLARS: PillarKey[] = ['inflow', 'outflow', 'life', 'productivity', 'businessModel'];

/** Equal weights, the research's recommended starting point. */
export const PILLAR_WEIGHTS: Record<PillarKey, number> = { inflow: 0.2, outflow: 0.2, life: 0.2, productivity: 0.2, businessModel: 0.2 };

/**
 * DRAFT: value kept by each end-of-life route. The R-ladder gives the order
 * (reuse and repair above recycling, recycling above energy recovery); the
 * values are equal steps down that order until expert (AHP) weights exist.
 */
export const ROUTE_WEIGHT: Record<RecoveryRoute, number> = {
  'Reuse or repair': 1,
  'Refurbish or remanufacture': 0.75,
  'Recycle or compost': 0.5,
  'Energy recovery': 0.25,
  'Landfill or incineration': 0,
};
export const ROUTES = Object.keys(ROUTE_WEIGHT) as RecoveryRoute[];

/**
 * DRAFT: product life & utility is normalized with min–max on X from 0 to 2,
 * so a product that lasts as long as a typical one scores 0.5 and one that
 * lasts (or is used) twice as much scores 1.
 */
export const LIFE_X_MAX = 2;

/**
 * DRAFT: resource productivity (revenue per kg of linear, i.e. virgin, input)
 * is min–max normalized on a log scale between these bounds until sector
 * benchmarks are available.
 */
export const PRODUCTIVITY_RANGE = { min: 5, max: 500 };

/**
 * DRAFT: geometric aggregation needs values above zero. A pillar that was
 * measured as zero counts as this floor, so the score still moves with the
 * other pillars (OECD/JRC note this as a requirement of geometric means).
 */
export const ZERO_FLOOR = 0.01;

/** Fewer measured pillars than this and there is no score yet. */
export const MIN_PILLARS = 2;

/** Global share of secondary materials in the economy: Circularity Gap Report 2025 (for 2021). */
export const GLOBAL_CIRCULARITY_PCT = 6.9;

/** Income categories that count as a circular business model. */
export const CIRCULAR_INCOME_CATEGORIES = new Set(['Repair service', 'Resale / second-hand', 'Rental', 'Take-back / refurbish', 'Recycling service']);

export type ScoreLevel = 'starter' | 'grower' | 'leader';

/** DRAFT: score at which each level starts (not from the research). */
export const LEVEL_FROM: Record<ScoreLevel, number> = { starter: 0, grower: 40, leader: 70 };

export function levelFor(score: number): ScoreLevel {
  if (score >= LEVEL_FROM.leader) return 'leader';
  if (score >= LEVEL_FROM.grower) return 'grower';
  return 'starter';
}

export interface Pillar {
  key: PillarKey;
  weight: number;
  /** 0–1, or null when there is no data for it yet (left out of the score, not counted as zero). */
  value: number | null;
  /** The measured number behind the value, in its own unit (%, × typical life, $ per kg). */
  raw: number | null;
  /** How many products had data, for pillars measured per product. */
  coverage?: { measured: number; total: number };
}

export interface CircularityScore {
  /** 0–100 geometric CIS, or null until enough pillars are measured. */
  score: number | null;
  level: ScoreLevel | null;
  pillars: Pillar[];
  /** The same pillars aggregated linearly, for the sensitivity band. */
  linear: number | null;
  /** Lowest and highest score across the two aggregation methods. */
  range: [number, number] | null;
}

export interface ScoreInputs {
  products: Product[];
  /** Units of each product sold in the period. */
  units: Record<string, number>;
  /** Materials sold in the period (circularityFrom). */
  circ: CircularityStats;
  /** Revenue from product sales in the period. */
  productRevenue: number;
  /** Share (0–100) of income from circular activities; null when there was no income. */
  circularIncomeShare: number | null;
  /** Waste and returned-product records in the period. */
  waste: WasteEntry[];
}

const productKg = (p: Product) => p.materials.reduce((s, m) => s + m.weightKg, 0);

function lifePillar(products: Product[], units: Record<string, number>): Pick<Pillar, 'value' | 'raw' | 'coverage'> {
  const sold = products.filter((p) => (units[p.id] ?? 0) > 0);
  const measured = sold.filter((p) => p.lifetimeYears && p.typicalLifetimeYears && p.lifetimeYears > 0 && p.typicalLifetimeYears > 0);
  const coverage = { measured: measured.length, total: sold.length };
  if (!measured.length) return { value: null, raw: null, coverage };
  // Company level = product values weighted by the mass sold (EMF company-level MCI), or by units when no weights are known.
  let wSum = 0;
  let xSum = 0;
  let pSum = 0;
  for (const p of measured) {
    const w = productKg(p) * units[p.id]! || units[p.id]!;
    const x = (p.lifetimeYears! / p.typicalLifetimeYears!) * (p.useIntensity ?? 1);
    wSum += w;
    xSum += w * x;
    pSum += w * clamp(x / LIFE_X_MAX, 0, 1);
  }
  return { value: pSum / wSum, raw: xSum / wSum, coverage };
}

function productivityPillar(circ: CircularityStats, revenue: number): Pick<Pillar, 'value' | 'raw'> {
  if (!circ.hasData || revenue <= 0) return { value: null, raw: null };
  if (circ.virginKg <= 0) return { value: 1, raw: null }; // no linear input at all
  const perKg = revenue / circ.virginKg;
  const lo = Math.log10(PRODUCTIVITY_RANGE.min);
  const hi = Math.log10(PRODUCTIVITY_RANGE.max);
  return { value: clamp((Math.log10(perKg) - lo) / (hi - lo), 0, 1), raw: perKg };
}

function outflowPillar(waste: WasteEntry[]): Pick<Pillar, 'value' | 'raw'> {
  const total = waste.reduce((s, w) => s + w.kg, 0);
  if (total <= 0) return { value: null, raw: null };
  const kept = waste.reduce((s, w) => s + w.kg * ROUTE_WEIGHT[w.route], 0);
  const recovered = waste.filter((w) => w.route !== 'Landfill or incineration').reduce((s, w) => s + w.kg, 0);
  return { value: kept / total, raw: (recovered / total) * 100 };
}

export function circularityScore(input: ScoreInputs): CircularityScore {
  const life = lifePillar(input.products, input.units);
  const parts: Record<PillarKey, Pick<Pillar, 'value' | 'raw' | 'coverage'>> = {
    inflow: input.circ.hasData ? { value: input.circ.rate / 100, raw: input.circ.rate } : { value: null, raw: null },
    outflow: outflowPillar(input.waste),
    life,
    productivity: productivityPillar(input.circ, input.productRevenue),
    businessModel: input.circularIncomeShare === null ? { value: null, raw: null } : { value: input.circularIncomeShare / 100, raw: input.circularIncomeShare },
  };
  const pillars: Pillar[] = PILLARS.map((key) => ({ key, weight: PILLAR_WEIGHTS[key], ...parts[key] }));
  const measured = pillars.filter((p) => p.value !== null);
  if (measured.length < MIN_PILLARS) return { score: null, level: null, pillars, linear: null, range: null };
  // Missing pillars are excluded and the remaining weights scaled to sum to 1 (OECD/JRC: exclude and flag).
  const wTotal = measured.reduce((s, p) => s + p.weight, 0);
  const geo = 100 * Math.exp(measured.reduce((s, p) => s + (p.weight / wTotal) * Math.log(Math.max(p.value!, ZERO_FLOOR)), 0));
  const lin = 100 * measured.reduce((s, p) => s + (p.weight / wTotal) * p.value!, 0);
  const score = Math.round(geo);
  return {
    score,
    level: levelFor(score),
    pillars,
    linear: Math.round(lin),
    range: [Math.round(Math.min(geo, lin)), Math.round(Math.max(geo, lin))],
  };
}
