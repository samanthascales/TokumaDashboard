import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useStore } from '../store/AppStore';
import { Logo } from '../components/layout/Sidebar';
import { completion, ProfilePreview, STEPS, StepFields, stepValid, validate } from './onboarding/Steps';
import type { BusinessProfile } from '../types';
import { useT } from '../i18n';
import { fmtPct } from '../lib/format';
import { LanguageMenu } from '../components/layout/LanguageMenu';


export default function Onboarding() {
  const t = useT();
  const { setProfile, setRole, profile: saved } = useStore();
  const navigate = useNavigate();
  const [i, setI] = useState(0);
  const [p, setP] = useState<BusinessProfile>(saved);
  const [touched, setTouched] = useState<Partial<Record<keyof BusinessProfile, boolean>>>({});
  const step = STEPS[i]!;
  const pct = completion(p);

  const set = <K extends keyof BusinessProfile>(k: K, v: BusinessProfile[K]) => {
    setP((x) => ({ ...x, [k]: v }));
    setTouched((x) => ({ ...x, [k]: true }));
  };

  const next = () => {
    if (!stepValid(step.key, p)) {
      const keys = Object.keys(validate(step.key, p)) as (keyof BusinessProfile)[];
      setTouched((x) => ({ ...x, ...Object.fromEntries(keys.map((k) => [k, true])) }));
      return;
    }
    if (i < STEPS.length - 1) setI(i + 1);
    else {
      setProfile(p);
      setRole('business');
      navigate('/app');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-ink-950">
      <header className="flex h-16 items-center justify-between px-6">
        <Link to="/">
          <Logo />
        </Link>
        <div className="flex items-center gap-3">
          <LanguageMenu />
          <Link to="/app" className="text-sm font-medium text-gray-500 hover:text-gray-900 dark:hover:text-white">
            {t('Skip for now')} <span className="inline-block rtl:-scale-x-100">→</span>
          </Link>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-8 px-6 pb-16 pt-4 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">
              {t('Step {n} of {total}', { n: i + 1, total: STEPS.length })} · {t(step.label)}
            </span>
            <span className="font-semibold tabular-nums text-brand-700 dark:text-brand-400">{t('{pct} complete', { pct: fmtPct(pct, 0) })}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
            <div className="h-full rounded-full bg-brand-600 transition-all duration-500 dark:bg-brand-400" style={{ width: `${pct}%` }} />
          </div>
          <ol className="mt-6 grid grid-cols-4 gap-2">
            {STEPS.map((s, j) => {
              const done = j < i || (j !== i && stepValid(s.key, p) && j < i);
              return (
                <li key={s.key}>
                  <button
                    onClick={() => (j < i || STEPS.slice(0, j).every((x) => stepValid(x.key, p))) && setI(j)}
                    className={clsx('flex w-full flex-col items-center gap-2 rounded-lg p-2 text-center transition sm:flex-row sm:text-start', j === i ? 'bg-white shadow-card dark:bg-ink-900' : 'hover:bg-white/60 dark:hover:bg-white/[0.03]')}
                  >
                    <span className={clsx('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm', done ? 'bg-brand-600 text-white' : j === i ? 'bg-brand-50 text-brand-700 ring-2 ring-brand-600 dark:bg-brand-500/10 dark:text-brand-300' : 'bg-gray-100 text-gray-400 dark:bg-white/5')}>
                      {done ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                    </span>
                    <span className={clsx('hidden text-xs font-medium sm:block', j === i ? '' : 'text-gray-500')}>{t(s.label)}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div key={step.key} className="card mt-6 animate-page-in p-6">
            <h1 className="text-xl font-semibold">{t(step.label)}</h1>
            <p className="muted mb-6 mt-1 text-sm">
              {
                {
                  profile: t('Tell us who you are — this is how investors and partners will see you.'),
                  identity: t('The basics of your business. Fields validate as you type.'),
                  products: t('What you make and how it stays in the loop.'),
                  financials: t('Used to estimate funding eligibility. You can change this later.'),
                }[step.key]
              }
            </p>
            <StepFields step={step.key} p={p} set={set} touched={touched} />
            <div className="mt-8 flex items-center justify-between border-t border-gray-100 pt-5 dark:border-white/5">
              <button className="btn-ghost" disabled={i === 0} onClick={() => setI(i - 1)}>
                <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" /> {t('Back')}
              </button>
              <button className="btn-primary" onClick={next}>
                {i === STEPS.length - 1 ? t('Finish & open dashboard') : t('Next step')} <ArrowRight className="h-4 w-4 rtl:-scale-x-100" />
              </button>
            </div>
          </div>
        </div>
        <div className="lg:sticky lg:top-6 lg:self-start">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">{t('Live preview')}</p>
          <ProfilePreview p={p} pct={pct} />
        </div>
      </div>
    </div>
  );
}
