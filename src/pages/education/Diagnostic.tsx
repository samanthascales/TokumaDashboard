import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowLeft, ArrowRight, Clock } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { DIAGNOSTIC, MODULES } from '../../data/education';
import { DIAGNOSTIC_PASS_MARK, DIAGNOSTIC_QUESTIONS_PER_MODULE, DIAGNOSTIC_TIME_LIMIT_MIN, diagnosticRemainingMs } from '../../lib/education';
import { Card, CardHeader, Modal, PageHeader } from '../../components/ui';
import { useT } from '../../i18n';
import { ModuleStatusBadge, QuestionBlock } from './shared';

const clock = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function Intro() {
  const t = useT();
  const navigate = useNavigate();
  const { startDiagnostic } = useStore();
  return (
    <Card className="max-w-2xl">
      <CardHeader title={t('Before you start')} />
      <div className="space-y-3 p-5 text-sm leading-relaxed">
        <p>{t('The diagnostic checks what you already know, so you only study what you need.')}</p>
        <ul className="list-disc space-y-1.5 ps-5">
          <li>{t('{questions} multiple-choice questions: {perModule} for each of the four modules.', { questions: DIAGNOSTIC.length, perModule: DIAGNOSTIC_QUESTIONS_PER_MODULE })}</li>
          <li>{t('You have {minutes} minutes. The timer keeps running if you leave this page, and your answers are submitted when time runs out.', { minutes: DIAGNOSTIC_TIME_LIMIT_MIN })}</li>
          <li>{t('Get {pass} of {perModule} right on a module and it is marked pre-tested: you can skip its lessons and go straight to its deliverable.', { pass: DIAGNOSTIC_PASS_MARK, perModule: DIAGNOSTIC_QUESTIONS_PER_MODULE })}</li>
          <li>{t('Below that, the full module is added to your learning path.')}</li>
          <li>{t('You can take the diagnostic once.')}</li>
        </ul>
        <p className="muted text-xs">{t('The questions are placeholders until the real ones are written.')}</p>
      </div>
      <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3.5 dark:border-white/5">
        <button className="btn-secondary" onClick={() => navigate('/app/learn')}>
          {t('Not now')}
        </button>
        <button className="btn-primary" onClick={startDiagnostic}>
          {t('Start the timer')}
        </button>
      </div>
    </Card>
  );
}

function Quiz({ startedAt }: { startedAt: string }) {
  const t = useT();
  const { education, answerDiagnostic, submitDiagnostic } = useStore();
  const answers = education.diagnostic.answers;
  // Open on the first unanswered question, so coming back resumes where the owner stopped.
  const [i, setI] = useState(() => Math.max(0, DIAGNOSTIC.findIndex((q) => answers[q.id] === undefined)));
  const [now, setNow] = useState(Date.now);
  const [confirm, setConfirm] = useState(false);
  const left = diagnosticRemainingMs(startedAt, now);

  useEffect(() => {
    const h = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(h);
  }, []);
  useEffect(() => {
    if (left === 0) submitDiagnostic(true);
  }, [left, submitDiagnostic]);

  const q = DIAGNOSTIC[i]!;
  const mod = MODULES.find((m) => m.id === q.moduleId)!;
  const inModule = DIAGNOSTIC.filter((x) => x.moduleId === q.moduleId).indexOf(q) + 1;
  const unanswered = DIAGNOSTIC.filter((x) => answers[x.id] === undefined).length;
  const last = i === DIAGNOSTIC.length - 1;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-3 dark:border-white/5">
          <p className="text-sm">
            <span className="font-semibold">{t(mod.title)}</span>
            <span className="muted"> · {t('Question {n} of {total}', { n: inModule, total: DIAGNOSTIC_QUESTIONS_PER_MODULE })}</span>
          </p>
          <span
            className={clsx('flex items-center gap-1.5 text-sm font-semibold tabular-nums', left < 5 * 60_000 ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-200')}
            data-testid="diag-timer"
            aria-label={t('Time left')}
          >
            <Clock className="h-4 w-4" /> {clock(left)}
          </span>
        </div>
        <div className="h-1 bg-gray-100 dark:bg-white/5">
          <div className="h-full bg-brand-600 transition-all dark:bg-brand-400" style={{ width: `${((DIAGNOSTIC.length - unanswered) / DIAGNOSTIC.length) * 100}%` }} />
        </div>
        <div className="p-5">
          <QuestionBlock key={q.id} q={q} n={i + 1} value={answers[q.id]} onChange={(o) => answerDiagnostic(q.id, o)} />
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-5 py-3.5 dark:border-white/5">
          <button className="btn-secondary" disabled={i === 0} onClick={() => setI(i - 1)}>
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> {t('Back')}
          </button>
          {last ? (
            <button className="btn-primary" onClick={() => (unanswered ? setConfirm(true) : submitDiagnostic())}>
              {t('Submit diagnostic')}
            </button>
          ) : (
            <button className="btn-primary" onClick={() => setI(i + 1)}>
              {t('Next')} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </button>
          )}
        </div>
      </Card>

      <Card className="h-fit p-5">
        <p className="text-sm font-semibold">{t('All questions')}</p>
        <p className="muted mt-0.5 text-xs">{t('{done} of {total} answered', { done: DIAGNOSTIC.length - unanswered, total: DIAGNOSTIC.length })}</p>
        <div className="mt-4 space-y-3">
          {MODULES.map((m) => (
            <div key={m.id}>
              <p className="muted mb-1.5 text-[11px] font-semibold uppercase tracking-wider">{t('Module {n}', { n: m.number })}</p>
              <div className="flex flex-wrap gap-1.5">
                {DIAGNOSTIC.map((x, j) =>
                  x.moduleId !== m.id ? null : (
                    <button
                      key={x.id}
                      onClick={() => setI(j)}
                      aria-label={t('Go to question {n}', { n: j + 1 })}
                      aria-current={j === i}
                      className={clsx(
                        'h-6 w-6 rounded-md text-[10px] font-semibold tabular-nums transition',
                        j === i ? 'ring-2 ring-brand-600 dark:ring-brand-400' : '',
                        answers[x.id] !== undefined ? 'bg-brand-600 text-white dark:bg-brand-400 dark:text-ink-900' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-white/5 dark:text-gray-400',
                      )}
                    >
                      {j + 1}
                    </button>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
        <button className="btn-secondary mt-5 w-full" onClick={() => (unanswered ? setConfirm(true) : submitDiagnostic())}>
          {t('Submit diagnostic')}
        </button>
      </Card>

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        size="sm"
        title={t('Submit with unanswered questions?')}
        sub={t('{count} questions are unanswered. They will count as wrong.', { count: unanswered })}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setConfirm(false)}>
              {t('Keep going')}
            </button>
            <button className="btn-primary" onClick={() => submitDiagnostic()}>
              {t('Submit diagnostic')}
            </button>
          </>
        }
      >
        <p className="text-sm">{t('You can take the diagnostic once.')}</p>
      </Modal>
    </div>
  );
}

function Results() {
  const t = useT();
  const navigate = useNavigate();
  const { learning } = useStore();
  return (
    <Card className="max-w-2xl" data-testid="diag-results">
      <CardHeader title={t('Your results')} sub={t('Modules marked pre-tested skip straight to their deliverable. The others are added to your learning path.')} />
      <ul className="divide-y divide-gray-100 px-5 py-2 dark:divide-white/5">
        {learning.modules.map((m) => (
          <li key={m.module.id} className="flex items-center justify-between gap-3 py-3">
            <div>
              <p className="text-sm font-medium">{t(m.module.title)}</p>
              <p className="muted text-xs">{t('{correct} of {total} correct', { correct: m.diagnosticCorrect ?? 0, total: DIAGNOSTIC_QUESTIONS_PER_MODULE })}</p>
            </div>
            <ModuleStatusBadge status={m.pretested ? 'pretested' : 'assigned'} />
          </li>
        ))}
      </ul>
      <div className="flex justify-end border-t border-gray-100 px-5 py-3.5 dark:border-white/5">
        <button className="btn-primary" onClick={() => navigate('/app/learn')}>
          {t('Go to your learning path')} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
        </button>
      </div>
    </Card>
  );
}

export default function Diagnostic() {
  const t = useT();
  const navigate = useNavigate();
  const { education } = useStore();
  const { startedAt, submittedAt } = education.diagnostic;
  return (
    <>
      <PageHeader
        title={t('Diagnostic')}
        sub={t('Phase 1 of the learning program')}
        actions={
          <button className="btn-ghost" onClick={() => navigate('/app/learn')}>
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> {t('Back to Learn')}
          </button>
        }
      />
      {submittedAt ? <Results /> : startedAt ? <Quiz startedAt={startedAt} /> : <Intro />}
    </>
  );
}
