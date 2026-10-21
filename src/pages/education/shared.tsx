import clsx from 'clsx';
import { CheckCircle2, Circle } from 'lucide-react';
import type { McqQuestion } from '../../data/education';
import type { EduScoreKey, ModuleStatus } from '../../lib/education';
import { Badge } from '../../components/ui';
import { tk, useT } from '../../i18n';

export const SCORE_NAMES: Record<EduScoreKey, string> = {
  sustainability: tk('Sustainability Score'),
  investmentReadiness: tk('Investment Readiness Score'),
};

const STATUS: Record<ModuleStatus, { label: string; tone: 'green' | 'amber' | 'gray' | 'blue' }> = {
  locked: { label: tk('Locked'), tone: 'gray' },
  pretested: { label: tk('Pre-tested'), tone: 'blue' },
  assigned: { label: tk('Assigned'), tone: 'amber' },
  inProgress: { label: tk('In progress'), tone: 'amber' },
  complete: { label: tk('Complete'), tone: 'green' },
};

export function ModuleStatusBadge({ status }: { status: ModuleStatus }) {
  const t = useT();
  return (
    <Badge tone={STATUS[status].tone} dot>
      {t(STATUS[status].label)}
    </Badge>
  );
}

export function MilestoneIcon({ done }: { done: boolean }) {
  return done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" /> : <Circle className="h-4 w-4 shrink-0 text-gray-300 dark:text-white/20" />;
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/**
 * One multiple-choice question. With `reveal`, the right answer is marked once one is picked
 * (used by the ungraded knowledge checks). Question text is placeholder content, shown as-is.
 */
export function QuestionBlock({ q, n, value, onChange, reveal }: { q: McqQuestion; n: number; value: number | undefined; onChange: (i: number) => void; reveal?: boolean }) {
  const t = useT();
  const answered = value !== undefined;
  return (
    <div>
      <p id={`${q.id}-prompt`} className="text-sm font-medium leading-relaxed">
        {n}. {q.prompt}
      </p>
      <div className="mt-2 grid gap-2" role="radiogroup" aria-labelledby={`${q.id}-prompt`}>
        {q.options.map((o, i) => {
          const selected = value === i;
          const right = reveal && answered && i === q.correct;
          const wrong = reveal && selected && i !== q.correct;
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={reveal && answered}
              onClick={() => onChange(i)}
              className={clsx(
                'flex items-center gap-3 rounded-lg border px-3 py-2 text-start text-sm transition disabled:cursor-default',
                right
                  ? 'border-brand-600 bg-brand-50 dark:border-brand-400 dark:bg-brand-500/10'
                  : wrong
                    ? 'border-red-500 bg-red-50 dark:border-red-400 dark:bg-red-500/10'
                    : selected
                      ? 'border-brand-600 bg-brand-50 dark:border-brand-400 dark:bg-brand-500/10'
                      : 'border-gray-200 hover:border-gray-300 dark:border-white/10 dark:hover:border-white/20',
              )}
            >
              <span
                className={clsx(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                  selected ? 'bg-brand-600 text-white dark:bg-brand-400 dark:text-ink-900' : 'bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-300',
                )}
              >
                {LETTERS[i]}
              </span>
              <span>{o}</span>
            </button>
          );
        })}
      </div>
      {reveal && answered && (
        <p className={clsx('mt-2 text-xs font-medium', value === q.correct ? 'text-brand-700 dark:text-brand-400' : 'text-red-600 dark:text-red-400')}>
          {value === q.correct ? t('Correct') : t('Not quite. The right answer is {letter}.', { letter: LETTERS[q.correct]! })}
        </p>
      )}
    </div>
  );
}
