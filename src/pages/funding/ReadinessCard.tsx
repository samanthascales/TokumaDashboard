import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowRight, Check, Share2 } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { READINESS_FROM, type ReadinessKey, type ReadinessLevel } from '../../lib/readiness';
import { tk, useT } from '../../i18n';
import { Badge, Card, Term } from '../../components/ui';

export const READINESS_LABEL: Record<ReadinessKey, string> = {
  profile: tk('Business profile complete'),
  sales: tk('3 months of sales recorded'),
  expenses: tk('Expenses recorded'),
  cash: tk('Opening cash balance entered'),
  products: tk('Products have their materials listed'),
  circularity: tk('At least 3 circularity pillars measured'),
  profit: tk('Net profit over the last 90 days'),
  runway: tk('3 months of cash runway'),
  score: tk('Circularity score'),
};

export const readinessLevelName = (l: ReadinessLevel) => (l === 'ready' ? tk('Ready to apply') : l === 'building' ? tk('Building') : tk('Getting started'));
export const readinessTone = (l: ReadinessLevel) => (l === 'ready' ? 'green' : l === 'building' ? 'amber' : 'gray') as 'green' | 'amber' | 'gray';

/** A meter that fills as the owner adds what lenders and investors look for. */
export function ReadinessCard() {
  const t = useT();
  const { readiness } = useStore();
  const next = readiness.items.filter((i) => !i.done).sort((a, b) => b.max - b.points - (a.max - a.points));
  const segments = [
    { from: READINESS_FROM.early, to: READINESS_FROM.building },
    { from: READINESS_FROM.building, to: READINESS_FROM.ready },
    { from: READINESS_FROM.ready, to: 100 },
  ];
  return (
    <Card className="mb-5 p-5 sm:p-6" data-testid="readiness">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="card-title">
            <Term label={t('Funding readiness')}>
              <p>{t('How prepared your records are for a lender, investor or grant program, from 0 to 100. It fills up as you add the information they usually ask for and as your profit, cash and circularity improve.')}</p>
              <p className="text-gray-300">{t('It is a checklist, not a credit score or a loan offer. Lenders make their own decisions and set their own terms.')}</p>
            </Term>
          </h3>
          <p className="muted mt-0.5 text-sm">{t('What lenders and investors usually look for, and how much of it you have.')}</p>
        </div>
        <Badge tone={readinessTone(readiness.level)} dot>
          {t(readinessLevelName(readiness.level))}
        </Badge>
      </div>

      <div className="mt-4 flex items-end gap-3">
        <p className="text-4xl font-bold tabular-nums" data-testid="readiness-score">
          {readiness.score}
        </p>
        <p className="muted mb-1 text-sm">{t('of 100')}</p>
      </div>
      <div className="relative mt-2 h-3 overflow-hidden rounded-full bg-gray-100 dark:bg-white/5" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={readiness.score} aria-label={t('Funding readiness')}>
        <div className={clsx('h-full rounded-full transition-all duration-700', readiness.level === 'ready' ? 'bg-brand-600 dark:bg-brand-400' : readiness.level === 'building' ? 'bg-amber-400' : 'bg-gray-400')} style={{ width: `${readiness.score}%` }} />
        {segments.slice(1).map((s) => (
          <span key={s.from} className="absolute top-0 h-full w-px bg-white/80 dark:bg-ink-900" style={{ insetInlineStart: `${s.from}%` }} />
        ))}
      </div>
      <div className="muted mt-1 flex text-[11px]">
        {segments.map((sg, i) => (
          <span key={sg.from} className={clsx('truncate', i === 2 && 'text-end')} style={{ width: `${sg.to - sg.from}%` }}>
            {t(['Getting started', 'Building', 'Ready to apply'][i]!)}
          </span>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <ul className="space-y-1.5">
          {readiness.items.map((i) => (
            <li key={i.key} className="flex items-center gap-2.5 text-sm">
              <span className={clsx('flex h-5 w-5 shrink-0 items-center justify-center rounded-full', i.done ? 'bg-brand-600 text-white' : 'ring-1 ring-gray-300 dark:ring-white/20')}>{i.done && <Check className="h-3 w-3" />}</span>
              <span className={clsx('flex-1', i.done && 'muted')}>{t(READINESS_LABEL[i.key])}</span>
              <span className="muted text-xs tabular-nums">
                {i.points}/{i.max}
              </span>
            </li>
          ))}
        </ul>
        <div>
          <p className="text-sm font-semibold">{next.length ? t('Next steps to raise it') : t('Your records are in good shape')}</p>
          <ul className="mt-2 space-y-2">
            {next.slice(0, 3).map((i) => (
              <li key={i.key}>
                <Link to={i.to} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2 text-sm transition hover:border-brand-200 hover:bg-brand-50/50 dark:border-white/5 dark:hover:bg-brand-500/5">
                  <span>{t(READINESS_LABEL[i.key])}</span>
                  <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-brand-700 dark:text-brand-300">
                    {t('+{n} points', { n: i.max - i.points })} <ArrowRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link to="/app/share?type=lender" className="btn-secondary btn-sm mt-4">
            <Share2 className="h-3.5 w-3.5" /> {t('Share a report with a lender')}
          </Link>
        </div>
      </div>
    </Card>
  );
}
