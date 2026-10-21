import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowLeft, BadgeCheck, CheckCircle2, ClipboardCheck, Lock, PlayCircle } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { moduleById, type Lesson } from '../../data/education';
import { CHECKPOINT_PASS_MARK, DIAGNOSTIC_QUESTIONS_PER_MODULE } from '../../lib/education';
import { fmtDate, toISO } from '../../lib/format';
import { Badge, Card, CardHeader, EmptyState, Modal, PageHeader } from '../../components/ui';
import { useT } from '../../i18n';
import { DeliverableForm } from './Deliverables';
import { MilestoneIcon, ModuleStatusBadge, QuestionBlock } from './shared';

/** A lesson and its ungraded knowledge check. Finishing the check marks the lesson done. */
function LessonModal({ lesson, done, onClose, onComplete }: { lesson: Lesson; done: boolean; onClose: () => void; onComplete: () => void }) {
  const t = useT();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const checked = lesson.check.every((q) => answers[q.id] !== undefined);
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={lesson.title}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            {t('Close')}
          </button>
          {!done && (
            <button className="btn-primary" disabled={!checked} onClick={onComplete}>
              {t('Mark lesson as done')}
            </button>
          )}
        </>
      }
    >
      <div className="space-y-3 text-sm leading-relaxed">
        {lesson.body.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
      <div className="mt-6 rounded-xl border border-gray-200 p-4 dark:border-white/10">
        <p className="text-sm font-semibold">{t('Knowledge check')}</p>
        <p className="muted mb-4 text-xs">{t('Not graded. Answer each question to finish the lesson.')}</p>
        <div className="space-y-5">
          {lesson.check.map((q, i) => (
            <QuestionBlock key={q.id} q={q} n={i + 1} value={answers[q.id]} onChange={(o) => setAnswers((a) => ({ ...a, [q.id]: o }))} reveal />
          ))}
        </div>
      </div>
    </Modal>
  );
}

function CheckpointModal({ moduleId, onClose }: { moduleId: string; onClose: () => void }) {
  const t = useT();
  const { submitCheckpoint } = useStore();
  const mod = moduleById(moduleId)!;
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const unanswered = mod.checkpoint.filter((q) => answers[q.id] === undefined).length;
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={t('Checkpoint: {module}', { module: t(mod.title) })}
      sub={t('{count} questions. Your result counts toward your scores.', { count: mod.checkpoint.length })}
      footer={
        <>
          <span className="muted me-auto self-center text-xs">{t('{done} of {total} answered', { done: mod.checkpoint.length - unanswered, total: mod.checkpoint.length })}</span>
          <button className="btn-secondary" onClick={onClose}>
            {t('Cancel')}
          </button>
          <button
            className="btn-primary"
            disabled={unanswered > 0}
            onClick={() => {
              submitCheckpoint(mod.id, answers);
              onClose();
            }}
          >
            {t('Submit checkpoint')}
          </button>
        </>
      }
    >
      <div className="space-y-6">
        {mod.checkpoint.map((q, i) => (
          <QuestionBlock key={q.id} q={q} n={i + 1} value={answers[q.id]} onChange={(o) => setAnswers((a) => ({ ...a, [q.id]: o }))} />
        ))}
      </div>
    </Modal>
  );
}

export default function ModulePage() {
  const t = useT();
  const navigate = useNavigate();
  const { moduleId = '' } = useParams();
  const { learning, completeLesson } = useStore();
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [checkpointOpen, setCheckpointOpen] = useState(false);
  const state = learning.modules.find((m) => m.module.id === moduleId);
  if (!state) return <Navigate to="/app/learn" replace />;
  const { module: mod, pretested } = state;
  const lesson = mod.lessons.find((l) => l.id === lessonId) ?? null;
  const done = (id: string) => state.progress.lessonsDone.includes(id);
  const steps = learning.milestones.filter((x) => x.moduleId === mod.id);

  const header = (
    <PageHeader
      title={t(mod.title)}
      sub={`${t('Module {n}', { n: mod.number })} · ${mod.topics.map((x) => t(x)).join(' · ')}`}
      actions={
        <button className="btn-ghost" onClick={() => navigate('/app/learn')}>
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> {t('Back to Learn')}
        </button>
      }
    >
      <div className="mt-3">
        <ModuleStatusBadge status={state.status} />
      </div>
    </PageHeader>
  );

  if (!learning.diagnosticDone)
    return (
      <>
        {header}
        <Card>
          <EmptyState
            icon={<Lock className="h-6 w-6" />}
            title={t('Take the diagnostic first')}
            body={t('The diagnostic decides whether you need this module’s lessons or can go straight to its deliverable.')}
            action={
              <button className="btn-primary" onClick={() => navigate('/app/learn/diagnostic')}>
                {t('Go to the diagnostic')}
              </button>
            }
          />
        </Card>
      </>
    );

  return (
    <>
      {header}
      {pretested && (
        <Card className="mb-5 flex items-start gap-3 border-sky-200 bg-sky-50/60 p-4 dark:border-sky-400/20 dark:bg-sky-500/5">
          <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400" />
          <p className="text-sm">
            {t('You got {correct} of {total} on this module in the diagnostic, so it is pre-tested. The lessons are optional: go straight to the deliverable.', {
              correct: state.diagnosticCorrect ?? 0,
              total: DIAGNOSTIC_QUESTIONS_PER_MODULE,
            })}
          </p>
        </Card>
      )}
      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          <Card>
            <CardHeader title={t('Lessons')} sub={pretested ? t('Optional') : t('{done} of {total} done', { done: state.lessonsDone, total: mod.lessons.length })} />
            <ul className="divide-y divide-gray-100 px-5 py-2 dark:divide-white/5" data-testid="lessons">
              {mod.lessons.map((l, i) => (
                <li key={l.id} className="flex items-center gap-3 py-3">
                  <span
                    className={clsx(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                      done(l.id) ? 'bg-brand-600 text-white dark:bg-brand-400 dark:text-ink-900' : 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300',
                    )}
                  >
                    {done(l.id) ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                  </span>
                  <p className="flex-1 text-sm font-medium">{l.title}</p>
                  <button className="btn-ghost" onClick={() => setLessonId(l.id)}>
                    <PlayCircle className="h-4 w-4" /> {done(l.id) ? t('Review') : t('Start')}
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title={t('Checkpoint')} sub={t('A short graded quiz that closes the module.')} />
            <div className="flex flex-col gap-3 p-5 text-sm sm:flex-row sm:items-center" data-testid="checkpoint">
              <ClipboardCheck className="h-5 w-5 shrink-0 text-brand-600 dark:text-brand-400" />
              <div className="flex-1">
                {pretested ? (
                  <p>{t('Covered by the diagnostic: {correct} of {total}.', { correct: state.diagnosticCorrect ?? 0, total: DIAGNOSTIC_QUESTIONS_PER_MODULE })}</p>
                ) : state.checkpointResult ? (
                  <p>
                    {t('Latest result: {correct} of {total}', { correct: state.checkpointResult.correct, total: state.checkpointResult.total })}
                    <span className="muted"> · {fmtDate(toISO(new Date(state.checkpointResult.date)))}</span>
                  </p>
                ) : state.lessonsComplete ? (
                  <p>{t('Ready when you are.')}</p>
                ) : (
                  <p className="muted">{t('Finish the lessons to unlock the checkpoint.')}</p>
                )}
                {!pretested && CHECKPOINT_PASS_MARK === null && <p className="muted mt-1 text-xs">{t('The pass mark has not been decided yet, so taking the checkpoint completes this step.')}</p>}
              </div>
              {!pretested && (
                <button className={state.checkpointResult ? 'btn-secondary' : 'btn-primary'} disabled={!state.lessonsComplete} onClick={() => setCheckpointOpen(true)}>
                  {state.checkpointResult ? t('Retake checkpoint') : t('Start checkpoint')}
                </button>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title={`${t('Deliverable')}: ${t(mod.deliverable.title)}`}
              sub={t(mod.deliverable.desc)}
              right={state.deliverableDone ? <Badge tone="green">{t('Submitted')}</Badge> : undefined}
            />
            <div className="p-5" data-testid="deliverable">
              <DeliverableForm module={mod} />
            </div>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader title={t('Milestones')} sub={t('Finish all of them to complete the module.')} />
          <ul className="space-y-2 p-5">
            {steps.map((x) => (
              <li key={x.id} className={clsx('flex items-center gap-2 text-sm', x.done && 'muted')}>
                <MilestoneIcon done={x.done} /> {t(x.label)}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {lesson && (
        <LessonModal
          key={lesson.id}
          lesson={lesson}
          done={done(lesson.id)}
          onClose={() => setLessonId(null)}
          onComplete={() => {
            completeLesson(mod.id, lesson.id);
            setLessonId(null);
          }}
        />
      )}
      {checkpointOpen && <CheckpointModal moduleId={mod.id} onClose={() => setCheckpointOpen(false)} />}
    </>
  );
}
