import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowRight, ClipboardCheck, Lock, LockOpen } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { useSimulatedLoad } from '../../lib/hooks';
import { DIAGNOSTIC } from '../../data/education';
import {
  DIAGNOSTIC_PASS_MARK,
  DIAGNOSTIC_QUESTIONS_PER_MODULE,
  DIAGNOSTIC_TIME_LIMIT_MIN,
  diagnosticRemainingMs,
  type EduScoreKey,
  type LearningState,
} from '../../lib/education';
import { Badge, Card, CardHeader, CardSkeleton, Gauge, Ring } from '../../components/ui';
import { useT } from '../../i18n';
import { MilestoneIcon, ModuleStatusBadge, SCORE_NAMES } from './shared';

/** The six phases of the education program, as a progress strip. */
function PhaseStepper({ learning }: { learning: LearningState }) {
  const t = useT();
  const { modules, milestones, scores, matching, diagnosticDone, diagnosticStarted } = learning;
  const assigned = modules.filter((m) => !m.pretested);
  const learned = assigned.filter((m) => m.lessonsComplete && m.checkpointMet).length;
  const delivered = modules.filter((m) => m.deliverableDone).length;
  const reached = milestones.filter((m) => m.done).length;
  const scored = scores.sustainability.value !== null && scores.investmentReadiness.value !== null;
  const phases = [
    { label: t('Diagnostic'), done: diagnosticDone, detail: diagnosticDone ? t('Done') : diagnosticStarted ? t('In progress') : t('Not started') },
    {
      label: t('Learn'),
      done: diagnosticDone && learned === assigned.length,
      detail: !diagnosticDone ? t('After the diagnostic') : assigned.length ? t('{done} of {total} modules', { done: learned, total: assigned.length }) : t('All modules pre-tested'),
    },
    { label: t('Apply'), done: delivered === modules.length, detail: t('{done} of {total} deliverables', { done: delivered, total: modules.length }) },
    { label: t('Milestones'), done: reached === milestones.length, detail: t('{done} of {total} done', { done: reached, total: milestones.length }) },
    { label: t('Scores'), done: scored, detail: scored ? t('Done') : t('Not calculated yet') },
    { label: t('Investor matching'), done: matching.unlocked, detail: matching.unlocked ? t('Unlocked') : t('Locked') },
  ];
  const current = phases.findIndex((p) => !p.done);
  return (
    <Card className="mb-5 overflow-x-auto p-5">
      <ol className="flex min-w-[680px] items-start" data-testid="phase-stepper">
        {phases.map((p, i) => (
          <li key={p.label} className="relative flex flex-1 flex-col items-center px-1 text-center">
            {i > 0 && <span className={clsx('absolute end-1/2 top-4 h-0.5 w-full', phases[i - 1]!.done ? 'bg-brand-600 dark:bg-brand-400' : 'bg-gray-200 dark:bg-white/10')} aria-hidden />}
            <span
              className={clsx(
                'relative flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ring-4 ring-white dark:ring-ink-900',
                p.done ? 'bg-brand-600 text-white dark:bg-brand-400 dark:text-ink-900' : i === current ? 'bg-brand-50 text-brand-700 ring-brand-100 dark:bg-brand-500/15 dark:text-brand-300' : 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400',
              )}
            >
              {i + 1}
            </span>
            <span className={clsx('mt-2 text-xs font-semibold', i === current ? 'text-brand-700 dark:text-brand-400' : '')}>{p.label}</span>
            <span className="muted mt-0.5 text-[11px]">{p.detail}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function DiagnosticCta({ learning, startedAt }: { learning: LearningState; startedAt: string | null }) {
  const t = useT();
  const navigate = useNavigate();
  const minsLeft = startedAt ? Math.ceil(diagnosticRemainingMs(startedAt) / 60_000) : null;
  return (
    <Card className="mb-5 flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
        <ClipboardCheck className="h-6 w-6" />
      </span>
      <div className="flex-1">
        <p className="font-semibold">{learning.diagnosticStarted ? t('Continue your diagnostic') : t('Start with the diagnostic')}</p>
        <p className="muted mt-0.5 text-sm">
          {t('{questions} questions, {perModule} for each module, in {minutes} minutes. Get {pass} of {perModule} right on a module to skip its lessons and go straight to its deliverable.', {
            questions: DIAGNOSTIC.length,
            perModule: DIAGNOSTIC_QUESTIONS_PER_MODULE,
            minutes: DIAGNOSTIC_TIME_LIMIT_MIN,
            pass: DIAGNOSTIC_PASS_MARK,
          })}
        </p>
        {minsLeft !== null && <p className="mt-1 text-sm font-medium text-amber-700 dark:text-amber-300">{minsLeft > 0 ? t('{minutes} min left', { minutes: minsLeft }) : t('Time is up')}</p>}
      </div>
      <button className="btn-primary" onClick={() => navigate('/app/learn/diagnostic')}>
        {learning.diagnosticStarted ? (minsLeft ? t('Continue') : t('See your results')) : t('Start diagnostic')}
      </button>
    </Card>
  );
}

export default function Program() {
  const t = useT();
  const navigate = useNavigate();
  const ready = useSimulatedLoad('program');
  const { learning, education } = useStore();
  const { modules, milestones, scores, matching } = learning;
  const reached = milestones.filter((m) => m.done).length;
  const completed = modules.filter((m) => m.complete).length;

  if (!ready)
    return (
      <div className="grid grid-cols-12 gap-5">
        <CardSkeleton className="col-span-12 h-[110px]" lines={2} />
        {modules.map((m) => (
          <CardSkeleton key={m.module.id} className="col-span-12 h-[230px] sm:col-span-6 xl:col-span-3" />
        ))}
      </div>
    );

  return (
    <>
      <PhaseStepper learning={learning} />
      {!learning.diagnosticDone && <DiagnosticCta learning={learning} startedAt={education.diagnostic.startedAt} />}

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {modules.map((m) => {
          const open = () => navigate(`/app/learn/modules/${m.module.id}`);
          return (
            <Card
              key={m.module.id}
              hover
              className="flex cursor-pointer flex-col p-5 transition hover:-translate-y-0.5"
              onClick={open}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && open()}
              data-testid={`module-card-${m.module.id}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-400">{t('Module {n}', { n: m.module.number })}</p>
                <ModuleStatusBadge status={m.status} />
              </div>
              <p className="mt-1 font-semibold leading-snug">{t(m.module.title)}</p>
              <p className="muted mt-1 flex-1 text-sm">{m.module.topics.map((x) => t(x)).join(' · ')}</p>
              <dl className="mt-4 space-y-1.5 border-t border-gray-100 pt-3 text-sm dark:border-white/5">
                {[
                  [t('Diagnostic'), m.diagnosticCorrect === null ? '—' : `${m.diagnosticCorrect}/${DIAGNOSTIC_QUESTIONS_PER_MODULE}`],
                  [t('Lessons'), m.pretested ? t('Optional') : `${m.lessonsDone}/${m.module.lessons.length}`],
                  [t('Checkpoint'), m.pretested ? t('Covered by the diagnostic') : m.checkpointResult ? `${m.checkpointResult.correct}/${m.checkpointResult.total}` : '—'],
                  [t('Deliverable'), m.deliverableDone ? t('Submitted') : t('Not yet')],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="muted">{k}</dt>
                    <dd className="text-end font-medium tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-12 gap-5">
        <Card className="col-span-12 lg:col-span-4">
          <CardHeader title={t('Milestones')} sub={t('{done} of {total} done', { done: reached, total: milestones.length })} right={<Ring value={(reached / milestones.length) * 100} />} />
          <div className="space-y-4 p-5" data-testid="milestones">
            {[undefined, ...modules.map((m) => m.module.id)].map((id) => {
              const items = milestones.filter((x) => x.moduleId === id);
              const mod = modules.find((m) => m.module.id === id);
              return (
                <div key={id ?? 'start'}>
                  {mod && <p className="mb-1.5 text-xs font-semibold">{t(mod.module.title)}</p>}
                  <ul className="space-y-1.5">
                    {items.map((x) => (
                      <li key={x.id} className={clsx('flex items-center gap-2 text-sm', x.done && 'muted')}>
                        <MilestoneIcon done={x.done} /> {t(x.label)}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="col-span-12 lg:col-span-4">
          <CardHeader title={t('Your scores')} sub={t('Given when you finish all four modules. Investors see them on your profile.')} />
          <div className="grid grid-cols-2 gap-4 p-5" data-testid="edu-scores">
            {(Object.keys(scores) as EduScoreKey[]).map((key) => {
              const s = scores[key];
              return (
                <div key={key} className="flex flex-col items-center text-center">
                  <Gauge value={s.value} />
                  <p className="mt-2 text-sm font-semibold">{t(SCORE_NAMES[key])}</p>
                  {!s.weightsSet ? (
                    <p className="muted mt-1 text-xs">{t('Not calculated yet: how the score is weighted has not been decided.')}</p>
                  ) : s.missing.length ? (
                    <p className="muted mt-1 text-xs">{t('Finish these modules first: {modules}', { modules: s.missing.map((id) => t(modules.find((m) => m.module.id === id)!.module.title)).join(', ') })}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="col-span-12 lg:col-span-4" data-testid="matching">
          <CardHeader
            title={t('Investor matching')}
            right={
              matching.unlocked ? (
                <Badge tone="green">
                  <LockOpen className="h-3 w-3" /> {t('Unlocked')}
                </Badge>
              ) : (
                <Badge>
                  <Lock className="h-3 w-3" /> {t('Locked')}
                </Badge>
              )
            }
          />
          <div className="p-5 text-sm">
            {matching.unlocked ? (
              <>
                <p>{t('Investors can now find your business. Your profile shows them:')}</p>
                <ul className="mt-3 space-y-1.5">
                  <li className="flex items-center gap-2">
                    <MilestoneIcon done /> {t('Modules completed: {done} of {total}', { done: completed, total: modules.length })}
                  </li>
                  {(Object.keys(scores) as EduScoreKey[]).map((key) => (
                    <li key={key} className="flex items-center gap-2">
                      <MilestoneIcon done /> {t(SCORE_NAMES[key])}: {scores[key].value}
                    </li>
                  ))}
                  <li className="flex items-center gap-2">
                    <MilestoneIcon done /> {t('Sales, materials and money from your records')}
                  </li>
                  <li className="flex items-center gap-2">
                    <MilestoneIcon done /> {t('Supplier risk')}
                  </li>
                </ul>
                <button className="btn-primary mt-4" onClick={() => navigate('/app/investor')}>
                  {t('Preview your investor profile')} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                </button>
              </>
            ) : (
              <>
                <p className="muted">{t('Your profile opens to investors once both scores reach the minimum.')}</p>
                <ul className="mt-3 space-y-2">
                  {matching.checks.map((c) => (
                    <li key={c.key} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2">
                        <MilestoneIcon done={c.met} /> {t(SCORE_NAMES[c.key])}
                      </span>
                      <span className="tabular-nums text-gray-600 dark:text-gray-300">
                        {c.score ?? '—'} / {c.threshold ?? '—'}
                      </span>
                    </li>
                  ))}
                </ul>
                {!matching.thresholdsSet && <p className="muted mt-3 text-xs">{t('The minimum scores have not been decided yet.')}</p>}
              </>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
