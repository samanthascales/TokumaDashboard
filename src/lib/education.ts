import { DIAGNOSTIC, DIAGNOSTIC_QUESTIONS_PER_MODULE, MODULES, type EduModule, type McqQuestion } from '../data/education';
import { tk } from '../i18n';
import type { EducationProgress, ModuleId, ModuleProgress, QuizResult } from '../types';

/**
 * The education program's rules: learning path, milestones, the two scores and
 * the investor-matching gate. Everything that decides them lives in this file.
 *
 * Numbers the spec doesn't give are null, with a TODO. A null weight keeps that
 * score "not calculated", and a null threshold keeps investor matching locked,
 * so no made-up number ever reaches the screen.
 */

/* ---------------- From the spec ---------------- */

export { DIAGNOSTIC_QUESTIONS_PER_MODULE };
/** Correct answers (out of 12) needed on a module to mark it "pre-tested" and skip to its deliverable. */
export const DIAGNOSTIC_PASS_MARK = 9;
export const DIAGNOSTIC_TIME_LIMIT_MIN = 75;

/* ---------------- Not in the spec yet ---------------- */

// TODO(spec): pass mark for a module's checkpoint, as correct answers out of its questions.
// Until set, taking the checkpoint is enough to meet that milestone.
export const CHECKPOINT_PASS_MARK: number | null = null;

// TODO(spec): weights for the Sustainability Score, a weighted average of the 4 modules' checkpoint results.
export const SUSTAINABILITY_WEIGHTS: Record<ModuleId, number | null> = {
  sustainability: null,
  operations: null,
  finance: null,
  impact: null,
};

// TODO(spec): weights for the Investment Readiness Score. The spec says it is "weighted toward
// Module 3 (Financial & Investment Readiness) + Module 4 (Impact Measurement) deliverables".
// A module counts only once its deliverable is submitted; its value is its checkpoint result.
export const INVESTMENT_READINESS_WEIGHTS: Record<ModuleId, number | null> = {
  sustainability: null,
  operations: null,
  finance: null,
  impact: null,
};

// TODO(spec): minimum scores (0–100) that unlock investor matching (Phase 6). The spec says "needs a number".
export const MATCHING_THRESHOLDS: Record<EduScoreKey, number | null> = {
  sustainability: null,
  investmentReadiness: null,
};

/* ---------------- Progress ---------------- */

export const MODULE_IDS = MODULES.map((m) => m.id);

const emptyModule = (): ModuleProgress => ({ lessonsDone: [], checkpoint: null, deliverable: null });

export function emptyEducation(): EducationProgress {
  return {
    diagnostic: { startedAt: null, answers: {}, submittedAt: null },
    modules: Object.fromEntries(MODULE_IDS.map((id) => [id, emptyModule()])) as Record<ModuleId, ModuleProgress>,
  };
}

/** Fills in anything missing, so progress saved by an older version always has every field. */
export function normalizeEducation(raw: Partial<EducationProgress> | null | undefined): EducationProgress {
  const base = emptyEducation();
  const r = raw ?? {};
  return {
    diagnostic: { ...base.diagnostic, ...(r.diagnostic ?? {}) },
    modules: Object.fromEntries(MODULE_IDS.map((id) => [id, { ...base.modules[id], ...(r.modules?.[id] ?? {}) }])) as Record<ModuleId, ModuleProgress>,
  };
}

export const countCorrect = (questions: McqQuestion[], answers: Record<string, number>) => questions.filter((q) => answers[q.id] === q.correct).length;

/** Milliseconds left on the diagnostic timer (never below 0). */
export function diagnosticRemainingMs(startedAt: string, now = Date.now()) {
  return Math.max(0, new Date(startedAt).getTime() + DIAGNOSTIC_TIME_LIMIT_MIN * 60_000 - now);
}

export const pct = (r: QuizResult) => (r.total ? (r.correct / r.total) * 100 : 0);

/* ---------------- Learning path and milestones ---------------- */

export type ModuleStatus = 'locked' | 'pretested' | 'assigned' | 'inProgress' | 'complete';

export interface ModuleState {
  module: EduModule;
  progress: ModuleProgress;
  /** Correct diagnostic answers for this module; null before the diagnostic is submitted. */
  diagnosticCorrect: number | null;
  pretested: boolean;
  status: ModuleStatus;
  lessonsDone: number;
  lessonsComplete: boolean;
  /** The result that counts: the diagnostic for pre-tested modules, the checkpoint otherwise. */
  checkpointResult: QuizResult | null;
  checkpointMet: boolean;
  deliverableDone: boolean;
  complete: boolean;
}

export interface Milestone {
  id: string;
  /** Translation key. */
  label: string;
  moduleId?: ModuleId;
  done: boolean;
}

export type EduScoreKey = 'sustainability' | 'investmentReadiness';

export interface EduScore {
  /** null until the weights are set and every weighted module has a result. */
  value: number | null;
  weightsSet: boolean;
  /** Weighted modules without a result yet. */
  missing: ModuleId[];
}

export interface Matching {
  unlocked: boolean;
  thresholdsSet: boolean;
  checks: { key: EduScoreKey; score: number | null; threshold: number | null; met: boolean }[];
}

export interface LearningState {
  diagnosticStarted: boolean;
  diagnosticDone: boolean;
  modules: ModuleState[];
  milestones: Milestone[];
  scores: Record<EduScoreKey, EduScore>;
  matching: Matching;
}

function moduleState(module: EduModule, progress: ModuleProgress, edu: EducationProgress): ModuleState {
  const submitted = !!edu.diagnostic.submittedAt;
  const questions = DIAGNOSTIC.filter((q) => q.moduleId === module.id);
  const diagnosticCorrect = submitted ? countCorrect(questions, edu.diagnostic.answers) : null;
  const pretested = diagnosticCorrect !== null && diagnosticCorrect >= DIAGNOSTIC_PASS_MARK;
  const lessonsDone = module.lessons.filter((l) => progress.lessonsDone.includes(l.id)).length;
  const lessonsComplete = lessonsDone === module.lessons.length;
  const checkpointResult: QuizResult | null =
    pretested && edu.diagnostic.submittedAt ? { correct: diagnosticCorrect!, total: questions.length, date: edu.diagnostic.submittedAt } : progress.checkpoint;
  const checkpointMet = pretested || (!!checkpointResult && (CHECKPOINT_PASS_MARK === null || checkpointResult.correct >= CHECKPOINT_PASS_MARK));
  const deliverableDone = !!progress.deliverable;
  const complete = submitted && deliverableDone && (pretested || (lessonsComplete && checkpointMet));
  const started = lessonsDone > 0 || !!progress.checkpoint || deliverableDone;
  const status: ModuleStatus = !submitted ? 'locked' : complete ? 'complete' : pretested ? 'pretested' : started ? 'inProgress' : 'assigned';
  return { module, progress, diagnosticCorrect, pretested, status, lessonsDone, lessonsComplete, checkpointResult, checkpointMet, deliverableDone, complete };
}

function weightedScore(weights: Record<ModuleId, number | null>, modules: ModuleState[]): EduScore {
  const weightsSet = MODULE_IDS.every((id) => weights[id] !== null) && MODULE_IDS.some((id) => weights[id]! > 0);
  // Without weights every module is treated as counting, so the missing list still guides the owner.
  const counted = modules.filter((m) => (weightsSet ? weights[m.module.id]! > 0 : true));
  // A module's value is its checkpoint result, once the module (deliverable included) is complete.
  const missing = counted.filter((m) => !m.complete || !m.checkpointResult).map((m) => m.module.id);
  if (!weightsSet || missing.length) return { value: null, weightsSet, missing };
  const total = counted.reduce((s, m) => s + weights[m.module.id]!, 0);
  const value = Math.round(counted.reduce((s, m) => s + weights[m.module.id]! * pct(m.checkpointResult!), 0) / total);
  return { value, weightsSet, missing };
}

export function learningState(edu: EducationProgress): LearningState {
  const modules = MODULES.map((m) => moduleState(m, edu.modules[m.id], edu));
  const diagnosticDone = !!edu.diagnostic.submittedAt;
  const milestones: Milestone[] = [
    { id: 'diagnostic', label: tk('Take the diagnostic'), done: diagnosticDone },
    ...modules.flatMap((m) => [
      ...(m.pretested ? [] : [{ id: `${m.module.id}-lessons`, label: tk('Finish the lessons'), moduleId: m.module.id, done: m.lessonsComplete }]),
      { id: `${m.module.id}-checkpoint`, label: tk('Pass the checkpoint'), moduleId: m.module.id, done: diagnosticDone && m.checkpointMet },
      { id: `${m.module.id}-deliverable`, label: tk('Submit the deliverable'), moduleId: m.module.id, done: m.deliverableDone },
    ]),
  ];
  const scores: Record<EduScoreKey, EduScore> = {
    sustainability: weightedScore(SUSTAINABILITY_WEIGHTS, modules),
    investmentReadiness: weightedScore(INVESTMENT_READINESS_WEIGHTS, modules),
  };
  const checks = (Object.keys(MATCHING_THRESHOLDS) as EduScoreKey[]).map((key) => {
    const score = scores[key].value;
    const threshold = MATCHING_THRESHOLDS[key];
    return { key, score, threshold, met: score !== null && threshold !== null && score >= threshold };
  });
  const thresholdsSet = checks.every((c) => c.threshold !== null);
  return {
    diagnosticStarted: !!edu.diagnostic.startedAt,
    diagnosticDone,
    modules,
    milestones,
    scores,
    matching: { unlocked: thresholdsSet && checks.every((c) => c.met), thresholdsSet, checks },
  };
}
