import { clamp } from './format';

/**
 * The business circularity score (0–100): Tokuma's main measure of how
 * circular a business is, shown next to profit.
 *
 * DRAFT METHOD — research on how to score circularity is still under way.
 * Everything that decides the score lives in this file, so the method can be
 * changed in one place. Each part is 0–100; parts with no data yet are left
 * out and the remaining weights are scaled up, so a missing number never
 * counts as zero.
 */
export const SCORE_VERSION = 'Draft 0.1';

export type ScorePartKey = 'materials' | 'income' | 'suppliers';

export const SCORE_WEIGHTS: Record<ScorePartKey, number> = {
  /** Share of the weight of products sold that came from recycled or reused material. */
  materials: 60,
  /** Share of income from circular activities: repairs, resale, rental, take-back. */
  income: 20,
  /** Average sustainability rating of suppliers, where the owner entered one. */
  suppliers: 20,
};

/** Income categories that count as circular activities. */
export const CIRCULAR_INCOME_CATEGORIES = new Set(['Repair service', 'Resale / second-hand', 'Rental', 'Take-back / refurbish']);

export type ScoreLevel = 'starter' | 'grower' | 'leader';

/** Score at which each level starts. */
export const LEVEL_FROM: Record<ScoreLevel, number> = { starter: 0, grower: 40, leader: 70 };

export interface ScorePart {
  key: ScorePartKey;
  weight: number;
  value: number | null;
}

export interface CircularityScore {
  /** null until the business has sales (or circular income) to score. */
  score: number | null;
  level: ScoreLevel | null;
  parts: ScorePart[];
}

export function levelFor(score: number): ScoreLevel {
  if (score >= LEVEL_FROM.leader) return 'leader';
  if (score >= LEVEL_FROM.grower) return 'grower';
  return 'starter';
}

export function circularityScore(input: { materials: number | null; income: number | null; suppliers: number | null }): CircularityScore {
  const parts: ScorePart[] = (Object.keys(SCORE_WEIGHTS) as ScorePartKey[]).map((key) => ({
    key,
    weight: SCORE_WEIGHTS[key],
    value: input[key] === null ? null : clamp(input[key]!, 0, 100),
  }));
  // Supplier ratings alone don't make a score: the business has to have sold something.
  if (input.materials === null && input.income === null) return { score: null, level: null, parts };
  const known = parts.filter((p) => p.value !== null);
  const weight = known.reduce((s, p) => s + p.weight, 0);
  const score = Math.round(known.reduce((s, p) => s + p.weight * p.value!, 0) / weight);
  return { score, level: levelFor(score), parts };
}
