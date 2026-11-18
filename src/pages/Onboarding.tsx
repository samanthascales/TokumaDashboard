import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowLeft, ArrowRight, Compass, Package, PackagePlus, Receipt, Store, Wrench } from 'lucide-react';
import { useStore } from '../store/AppStore';
import { Logo } from '../components/layout/Sidebar';
import type { BusinessProfile } from '../types';
import { tk, useT } from '../i18n';
import { LanguageMenu } from '../components/layout/LanguageMenu';

/**
 * Three short screens: the business name, what the business does in the
 * owner's own words and whether it sells products, services or both (optional),
 * and what to do first. Everything else in the business profile is optional
 * and lives under Settings → Business profile.
 */

// Examples only: tapping one fills the answer, which the owner can then change.
const EXAMPLES = [tk('Clothing and bags'), tk('Café or food'), tk('Repair shop'), tk('Furniture'), tk('Cleaning service'), tk('Beauty and skin care')];

const OFFERINGS: { value: NonNullable<BusinessProfile['offering']>; label: string; body: string; icon: typeof Package }[] = [
  { value: 'products', label: tk('Products'), body: tk('Things you make or resell'), icon: Package },
  { value: 'services', label: tk('Services'), body: tk('Work you do for customers, like repairs or cleaning'), icon: Wrench },
  { value: 'both', label: tk('Both'), body: tk('Products and services'), icon: Store },
];

type Screen = 'name' | 'kind' | 'start';
const SCREENS: Screen[] = ['name', 'kind', 'start'];

function Choice({ icon, title, body, onClick, selected }: { icon: ReactNode; title: string; body?: string; onClick: () => void; selected?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex w-full items-center gap-4 rounded-xl border p-4 text-start transition',
        selected ? 'border-brand-600 bg-brand-50 dark:border-brand-400 dark:bg-brand-500/10' : 'border-gray-200 bg-white hover:border-brand-300 hover:bg-brand-50/40 dark:border-white/10 dark:bg-ink-900 dark:hover:bg-white/[0.03]',
      )}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">{icon}</span>
      <span className="min-w-0">
        <span className="block font-medium">{title}</span>
        {body && <span className="muted mt-0.5 block text-sm">{body}</span>}
      </span>
    </button>
  );
}

export default function Onboarding() {
  const t = useT();
  const { setProfile, setRole, profile: saved } = useStore();
  const navigate = useNavigate();
  const [screen, setScreen] = useState<Screen>('name');
  const [p, setP] = useState<BusinessProfile>(saved);
  const [tried, setTried] = useState(false);
  const i = SCREENS.indexOf(screen);
  const nameError = p.businessName.trim().length < 2 ? t('Enter your business name') : null;

  const finish = (to: string) => {
    setProfile(p);
    setRole('business');
    navigate(to);
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

      <main className="mx-auto max-w-lg px-6 pb-16 pt-6">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5" aria-hidden="true">
            {SCREENS.map((s, j) => (
              <span key={s} className={clsx('h-1.5 w-8 rounded-full transition', j <= i ? 'bg-brand-600 dark:bg-brand-400' : 'bg-gray-200 dark:bg-white/10')} />
            ))}
          </div>
          <span className="muted text-sm">{t('Step {n} of {total}', { n: i + 1, total: SCREENS.length })}</span>
        </div>

        <div key={screen} className="mt-8 animate-page-in">
          {screen === 'name' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setTried(true);
                if (!nameError) setScreen('kind');
              }}
            >
              <h1 className="text-2xl font-semibold">{t('What is your business called?')}</h1>
              <label className="mt-6 block">
                <span className="label">{t('Business name')}</span>
                <input autoFocus className={clsx('input text-base', tried && nameError && 'input-error')} value={p.businessName} onChange={(e) => setP({ ...p, businessName: e.target.value })} placeholder={t('Your business name')} />
                {tried && nameError && <span className="mt-1.5 block text-xs text-red-600 dark:text-red-400">{nameError}</span>}
              </label>
              <label className="mt-4 block">
                <span className="label">{t('Your first name (optional)')}</span>
                <input className="input text-base" value={p.ownerName} onChange={(e) => setP({ ...p, ownerName: e.target.value })} placeholder={t('Jane')} autoComplete="given-name" />
              </label>
              <button type="submit" className="btn-primary mt-8 w-full justify-center py-2.5">
                {t('Continue')} <ArrowRight className="h-4 w-4 rtl:-scale-x-100" />
              </button>
            </form>
          )}

          {screen === 'kind' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setScreen('start');
              }}
            >
              <h1 className="text-2xl font-semibold">{t('What does your business do?')}</h1>
              <p className="muted mt-1">{t('Describe it in your own words. You can change it later.')}</p>
              <input autoFocus className="input mt-6 text-base" value={p.industry} onChange={(e) => setP({ ...p, industry: e.target.value })} placeholder={t('e.g. We repair bikes and sell used parts')} aria-label={t('What does your business do?')} />
              <div className="mt-3 flex flex-wrap gap-2">
                {EXAMPLES.map((x) => (
                  <button key={x} type="button" onClick={() => setP({ ...p, industry: t(x) })} className="rounded-full px-3 py-1.5 text-sm text-gray-600 ring-1 ring-inset ring-gray-200 transition hover:ring-brand-300 dark:text-gray-300 dark:ring-white/10">
                    {t(x)}
                  </button>
                ))}
              </div>
              <p className="label mt-8">{t('What do you sell?')}</p>
              <div className="space-y-2">
                {OFFERINGS.map((o) => (
                  <Choice key={o.value} icon={<o.icon className="h-5 w-5" />} title={t(o.label)} body={t(o.body)} selected={p.offering === o.value} onClick={() => setP({ ...p, offering: o.value })} />
                ))}
              </div>
              <div className="mt-8 flex items-center justify-between">
                <button type="button" className="btn-ghost" onClick={() => setScreen('name')}>
                  <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" /> {t('Back')}
                </button>
                <button type="submit" className="btn-primary">
                  {p.industry.trim() || p.offering ? t('Continue') : t('Skip this question')} <ArrowRight className="h-4 w-4 rtl:-scale-x-100" />
                </button>
              </div>
            </form>
          )}

          {screen === 'start' && (
            <>
              <h1 className="text-2xl font-semibold">{t('What would you like to do first?')}</h1>
              <p className="muted mt-1">{t('You can do the others anytime.')}</p>
              <div className="mt-6 space-y-2">
                {p.offering !== 'services' && <Choice icon={<PackagePlus className="h-5 w-5" />} title={t('Add a product')} body={t('Tell Tokuma what you sell and what it is made of.')} onClick={() => finish('/app/products?new=product')} />}
                <Choice icon={<Receipt className="h-5 w-5" />} title={t('Record a sale')} body={t('Write down money that came in or went out.')} onClick={() => finish('/app/money?new=txn')} />
                <Choice icon={<Compass className="h-5 w-5" />} title={t('Look around first')} body={t('Go to your dashboard.')} onClick={() => finish('/app')} />
              </div>
              <button className="btn-ghost mt-8" onClick={() => setScreen('kind')}>
                <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" /> {t('Back')}
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
