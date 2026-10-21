import { tk } from '../i18n';
import type { DeliverableKind, ModuleId } from '../types';

/**
 * The education program's fixed content: four modules, their lessons and quizzes.
 *
 * PLACEHOLDER CONTENT — module titles and topics come from the education spec;
 * every lesson, question and answer option below is generated filler, marked
 * "[PLACEHOLDER]", until the real material is written. Placeholder text is
 * shown as-is (not translated); translate the real content when it replaces it.
 */
export const PLACEHOLDER = '[PLACEHOLDER]';

/** From the spec: the diagnostic has 12 questions per module (48 in all). */
export const DIAGNOSTIC_QUESTIONS_PER_MODULE = 12;

export interface McqQuestion {
  id: string;
  moduleId: ModuleId;
  prompt: string;
  options: string[];
  /** Index into `options`. */
  correct: number;
}

export interface Lesson {
  id: string;
  moduleId: ModuleId;
  title: string;
  /** The lesson itself, in short paragraphs. */
  body: string[];
  /** Short, ungraded knowledge check shown at the end of the lesson. */
  check: McqQuestion[];
}

export interface EduModule {
  id: ModuleId;
  /** 1–4, shown as "Module 1". */
  number: number;
  title: string;
  topics: string[];
  lessons: Lesson[];
  /** Graded quiz that closes the module. */
  checkpoint: McqQuestion[];
  deliverable: { kind: DeliverableKind; title: string; desc: string };
}

const LETTERS = ['A', 'B', 'C', 'D'];

/** Placeholder questions rotate the correct answer through A–D so pass and fail paths can be tried. */
function placeholderQuestions(moduleId: ModuleId, prefix: string, label: string, count: number): McqQuestion[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-${moduleId}-${i + 1}`,
    moduleId,
    prompt: `${PLACEHOLDER} ${label} ${i + 1} of ${count}`,
    options: LETTERS.map((l) => `${PLACEHOLDER} Option ${l}`),
    correct: i % LETTERS.length,
  }));
}

function placeholderLessons(moduleId: ModuleId, topics: string[]): Lesson[] {
  return topics.map((topic, i) => ({
    id: `lesson-${moduleId}-${i + 1}`,
    moduleId,
    title: `${PLACEHOLDER} Lesson ${i + 1}: ${topic}`,
    body: [`${PLACEHOLDER} Lesson content about “${topic}” goes here.`, `${PLACEHOLDER} Each lesson is meant to take 5–10 minutes.`],
    check: placeholderQuestions(moduleId, `check-${i + 1}`, `Knowledge check question`, 2),
  }));
}

function makeModule(id: ModuleId, number: number, title: string, topics: string[], deliverable: EduModule['deliverable']): EduModule {
  return {
    id,
    number,
    title,
    topics,
    // Lessons use the English topic names: they are placeholders too.
    lessons: placeholderLessons(id, topics),
    checkpoint: placeholderQuestions(id, 'checkpoint', 'Checkpoint question', 12),
    deliverable,
  };
}

export const MODULES: EduModule[] = [
  makeModule('sustainability', 1, tk('Sustainability Fundamentals'), [tk('Environmental impact'), tk('Resource efficiency'), tk('ESG basics')], {
    kind: 'statement',
    title: tk('Sustainability statement'),
    desc: tk('A short written statement about how your business affects the environment and what it does about it.'),
  }),
  makeModule('operations', 2, tk('Operational Sustainability'), [tk('Supply chain optimization'), tk('Waste reduction'), tk('Energy usage')], {
    kind: 'wasteLog',
    title: tk('Waste and materials log'),
    desc: tk('Record what materials go into your business and what comes out as waste.'),
  }),
  makeModule('finance', 3, tk('Financial & Investment Readiness'), [tk('Financial statements'), tk('Unit economics'), tk('Risk analysis')], {
    kind: 'financialSnapshot',
    title: tk('Financial snapshot'),
    desc: tk('Your revenue and costs for a recent period. Tokuma works out the margin.'),
  }),
  makeModule('impact', 4, tk('Impact Measurement'), [tk('KPIs and reporting'), tk('ESG metrics'), tk('Alignment with global standards')], {
    kind: 'kpi',
    title: tk('Your impact KPI'),
    desc: tk('Pick one measure of your impact that you will track from now on.'),
  }),
];

export const moduleById = (id: string) => MODULES.find((m) => m.id === id);

/** Phase 1 diagnostic: placeholder questions for each module, grouped by module. */
export const DIAGNOSTIC: McqQuestion[] = MODULES.flatMap((m) => placeholderQuestions(m.id, 'diag', 'Diagnostic question', DIAGNOSTIC_QUESTIONS_PER_MODULE));
