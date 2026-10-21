import { clamp } from './format';

/**
 * Funding readiness (0–100): how prepared a business's records are for a
 * lender or investor, shown as a meter that fills up as the owner adds data
 * (the pattern Clearco uses for funding capacity).
 *
 * It is a checklist, not a credit score or a loan offer: the research basis
 * for the circularity score warns that the link between circularity and
 * financing should be tested, not assumed, so nothing here promises a rate.
 */
export type ReadinessKey = 'profile' | 'sales' | 'expenses' | 'cash' | 'products' | 'circularity' | 'profit' | 'runway' | 'score';

export interface ReadinessItem {
  key: ReadinessKey;
  /** Points earned and the most this item can give. */
  points: number;
  max: number;
  done: boolean;
  /** Where in the app to work on it. */
  to: string;
}

export type ReadinessLevel = 'early' | 'building' | 'ready';

export interface Readiness {
  score: number;
  level: ReadinessLevel;
  items: ReadinessItem[];
}

export interface ReadinessInputs {
  profileComplete: boolean;
  /** Days between the first recorded sale and today. */
  salesDays: number;
  /** Any expense recorded in the last 90 days. */
  hasExpenses: boolean;
  openingCashSet: boolean;
  products: number;
  productsWithMaterials: number;
  /** Circularity pillars with data. */
  pillarsMeasured: number;
  /** Net profit over the last 90 days. */
  profit90: number;
  runwayMonths: number | null;
  circularityScore: number | null;
}

/** Score at which each level starts. */
export const READINESS_FROM: Record<ReadinessLevel, number> = { early: 0, building: 40, ready: 75 };

export function fundingReadiness(i: ReadinessInputs): Readiness {
  const item = (key: ReadinessKey, max: number, share: number, to: string): ReadinessItem => {
    const s = clamp(share, 0, 1);
    return { key, max, points: Math.round(max * s), done: s >= 1, to };
  };
  const items = [
    // Records a lender asks for first.
    item('profile', 10, i.profileComplete ? 1 : 0, '/app/settings?section=profile'),
    item('sales', 15, i.salesDays / 90, '/app/money?new=import'),
    item('expenses', 10, i.hasExpenses ? 1 : 0, '/app/money?new=txn'),
    item('cash', 5, i.openingCashSet ? 1 : 0, '/app/reports?tab=balance'),
    item('products', 10, i.products ? i.productsWithMaterials / i.products : 0, '/app/products'),
    item('circularity', 10, i.pillarsMeasured / 3, '/app/circularity'),
    // How the business is doing.
    item('profit', 15, i.profit90 > 0 ? 1 : 0, '/app/reports'),
    item('runway', 10, i.runwayMonths === null ? 0 : i.runwayMonths / 3, '/app/reports?tab=cash'),
    item('score', 15, (i.circularityScore ?? 0) / 100, '/app/circularity'),
  ];
  const score = items.reduce((s, x) => s + x.points, 0);
  const level: ReadinessLevel = score >= READINESS_FROM.ready ? 'ready' : score >= READINESS_FROM.building ? 'building' : 'early';
  return { score, level, items };
}
