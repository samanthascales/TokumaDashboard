import { useState, type InputHTMLAttributes } from 'react';
import clsx from 'clsx';
import { Building2, Check, Globe, Landmark, Leaf, Recycle, User, X } from 'lucide-react';
import { Avatar, Badge, Field, Toggle } from '../../components/ui';
import type { BusinessProfile } from '../../types';
import { t, tk, useT } from '../../i18n';

export type StepKey = 'profile' | 'identity' | 'products' | 'financials';
export const STEPS: { key: StepKey; label: string; icon: typeof User }[] = [
  { key: 'profile', label: tk('Profile'), icon: User },
  { key: 'identity', label: tk('Business identity'), icon: Building2 },
  { key: 'products', label: tk('Products & materials'), icon: Recycle },
  { key: 'financials', label: tk('Financials'), icon: Landmark },
];

const MATERIALS = [tk('Recycled cotton'), tk('Reclaimed denim'), tk('Hemp'), tk('Recycled polyester'), tk('Reclaimed wool'), tk('Bamboo'), tk('Reused canvas'), tk('Recycled nylon'), tk('Cork'), tk('Reclaimed wood')];
const MODELS = [tk('Recycled inputs'), tk('Reuse & resale'), tk('Repair & refurbish'), tk('Product-as-a-service'), tk('Recycled inputs + take-back')];
const INDUSTRIES = [tk('Apparel & Textiles'), tk('Food & Beverage'), tk('Furniture & Home'), tk('Electronics'), tk('Packaging'), tk('Beauty & Personal care'), tk('Repair & maintenance'), tk('Cleaning services')];
const OFFERING_LABELS = { products: tk('Products'), services: tk('Services'), both: tk('Products and services') } as const;
const TEAM_SIZES = [tk('Just me'), '2–5', '6–10', '11–50', '50+'];
const REVENUE_BANDS = [tk('Pre-revenue'), '<$100k', '$100k–$250k', '$250k–$1M', '$1M+'];

export type Errors = Partial<Record<keyof BusinessProfile, string | null>>;

// Only the business name is required; everything else is optional and only checked when filled in.
export function validate(step: StepKey, p: BusinessProfile): Errors {
  const e: Errors = {};
  if (step === 'profile') {
    e.ownerName = p.ownerName.trim() && p.ownerName.trim().length < 2 ? t('Enter your full name') : null;
    e.email = p.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email) ? t('Enter a valid email address') : null;
  }
  if (step === 'identity') {
    e.businessName = p.businessName.trim().length < 2 ? t('Business name is required') : null;
    e.founded = p.founded && !/^(19|20)\d{2}$/.test(p.founded) ? t('Use a 4-digit year') : p.founded && +p.founded > new Date().getFullYear() ? t('Year cannot be in the future') : null;
  }
  if (step === 'financials') {
    e.fundingGoal = p.fundingGoal && (isNaN(+p.fundingGoal) || +p.fundingGoal < 0) ? t('Enter a number') : null;
  }
  return e;
}

export const stepValid = (step: StepKey, p: BusinessProfile) => Object.values(validate(step, p)).every((v) => !v);

function Ok({ show }: { show: boolean }) {
  return show ? <Check className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-600" /> : null;
}

/** Main materials as free tags: type any material, or tap a suggestion. */
function MaterialTags({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const t = useT();
  const [draft, setDraft] = useState('');
  const add = (m: string) => {
    const v = m.trim();
    if (v && !value.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...value, v]);
    setDraft('');
  };
  const suggestions = MATERIALS.map((m) => t(m)).filter((m) => !value.includes(m));
  return (
    <div>
      <span className="label">{t('Main materials (optional)')}</span>
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {value.map((m) => (
            <span key={m} className="inline-flex items-center gap-1 rounded-full bg-brand-600 py-1.5 pe-2 ps-3 text-sm text-white">
              {t(m)}
              <button type="button" onClick={() => onChange(value.filter((x) => x !== m))} className="rounded-full p-0.5 hover:bg-white/20" aria-label={t('Remove {name}', { name: t(m) })}>
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          className="input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add(draft);
            }
          }}
          placeholder={t('Type a material, e.g. coffee grounds')}
          aria-label={t('Add a material')}
        />
        <button type="button" className="btn-secondary" onClick={() => add(draft)} disabled={!draft.trim()}>
          {t('Add')}
        </button>
      </div>
      {suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="muted text-xs">{t('Suggestions:')}</span>
          {suggestions.map((m) => (
            <button key={m} type="button" onClick={() => add(m)} className="rounded-full px-2.5 py-1 text-xs text-gray-600 ring-1 ring-inset ring-gray-200 hover:ring-gray-300 dark:text-gray-300 dark:ring-white/10">
              + {m}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function StepFields({ step, p, set, touched }: { step: StepKey; p: BusinessProfile; set: <K extends keyof BusinessProfile>(k: K, v: BusinessProfile[K]) => void; touched: Partial<Record<keyof BusinessProfile, boolean>> }) {
  useT();
  const errs = validate(step, p);
  const err = (k: keyof BusinessProfile) => (touched[k] ? errs[k] ?? null : null);
  const ok = (k: keyof BusinessProfile) => !!touched[k] && !errs[k];
  const input = (k: keyof BusinessProfile, props: InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="relative">
      <input className={clsx('input pe-9', err(k) && 'input-error')} value={String(p[k] ?? '')} onChange={(e) => set(k, e.target.value as never)} {...props} />
      <Ok show={ok(k)} />
    </div>
  );

  if (step === 'profile')
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('Full name')} error={err('ownerName')} className="sm:col-span-2">
          {input('ownerName', { placeholder: t('Jane Doe'), autoComplete: 'name' })}
        </Field>
        <Field label={t('Work email')} error={err('email')}>
          {input('email', { type: 'email', placeholder: t('you@company.com'), autoComplete: 'email' })}
        </Field>
        <Field label={t('Your role')} error={err('role')}>
          {input('role', { placeholder: t('Founder & CEO') })}
        </Field>
      </div>
    );

  if (step === 'identity')
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('Business name')} error={err('businessName')} className="sm:col-span-2">
          {input('businessName', { placeholder: t('Your business name') })}
        </Field>
        <Field label={t('Type of business')} hint={t('In your own words, or pick a suggestion')}>
          <input className="input" list="industry-suggestions" value={p.industry} onChange={(e) => set('industry', e.target.value)} placeholder={t('e.g. Bike repair shop')} />
          <datalist id="industry-suggestions">
            {INDUSTRIES.map((i) => (
              <option key={i} value={t(i)} />
            ))}
          </datalist>
        </Field>
        <Field label={t('What do you sell?')}>
          <select className="input" value={p.offering ?? ''} onChange={(e) => set('offering', (e.target.value || undefined) as BusinessProfile['offering'])}>
            <option value="">{t('Select…')}</option>
            {(Object.keys(OFFERING_LABELS) as (keyof typeof OFFERING_LABELS)[]).map((k) => (
              <option key={k} value={k}>{t(OFFERING_LABELS[k])}</option>
            ))}
          </select>
        </Field>
        <Field label={t('Country')} error={err('country')}>
          {input('country', { placeholder: t('Canada') })}
        </Field>
        <Field label={t('Year founded')} error={err('founded')}>
          {input('founded', { placeholder: '2021', inputMode: 'numeric', maxLength: 4 })}
        </Field>
        <Field label={t('Team size')}>
          <select className="input" value={p.employees} onChange={(e) => set('employees', e.target.value)}>
            <option value="">{t('Select team size')}</option>
            {TEAM_SIZES.map((i) => (
              <option key={i} value={i}>{t(i)}</option>
            ))}
          </select>
        </Field>
        <Field label={t('Website')} className="sm:col-span-2">
          {input('website', { placeholder: t('yourbrand.com') })}
        </Field>
        <Field label={t('What does your business do?')} error={err('description')} hint={`${p.description.length}/240`} className="sm:col-span-2">
          <textarea rows={3} maxLength={240} className={clsx('input resize-none', err('description') && 'input-error')} value={p.description} onChange={(e) => set('description', e.target.value)} placeholder={t('e.g. We make bags from reclaimed sailcloth and offer free repairs for life.')} />
        </Field>
      </div>
    );

  if (step === 'products')
    return (
      <div className="space-y-5">
        <MaterialTags value={p.primaryMaterials} onChange={(v) => set('primaryMaterials', v)} />
        <Field label={t('How do you keep things in use?')} hint={t('Optional. In your own words, or pick a suggestion')}>
          <input className="input" list="model-suggestions" value={p.circularModel} onChange={(e) => set('circularModel', e.target.value)} placeholder={t('e.g. We repair and resell used bikes')} />
          <datalist id="model-suggestions">
            {MODELS.map((m) => (
              <option key={m} value={t(m)} />
            ))}
          </datalist>
        </Field>
      </div>
    );

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={t('Annual revenue')} error={err('annualRevenue')}>
        <select className="input" value={p.annualRevenue} onChange={(e) => set('annualRevenue', e.target.value)}>
          <option value="">{t('Select…')}</option>
          {REVENUE_BANDS.map((i) => (
            <option key={i} value={i}>{t(i)}</option>
          ))}
        </select>
      </Field>
      <Field label={t('Funding goal ($)')} error={err('fundingGoal')} hint={t('Optional — helps match funders')}>
        {input('fundingGoal', { inputMode: 'numeric', placeholder: '50000' })}
      </Field>
      <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4 dark:border-white/10 sm:col-span-2">
        <div>
          <p className="text-sm font-medium">{t('Connect business bank account')}</p>
          <p className="muted text-xs">{t('Transactions import automatically and are categorised for you')}</p>
        </div>
        <Toggle checked={p.bankConnected} onChange={(v) => set('bankConnected', v)} label={t('Connect bank')} />
      </div>
    </div>
  );
}

export function ProfilePreview({ p, pct }: { p: BusinessProfile; pct: number }) {
  const t = useT();
  return (
    <div className="card overflow-hidden">
      <div className="h-20 bg-gradient-to-br from-brand-600 to-brand-900" />
      <div className="-mt-8 px-5 pb-5">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-xl font-bold text-brand-700 shadow-lift ring-4 ring-white dark:bg-ink-850 dark:text-brand-300 dark:ring-ink-900">
          {(p.businessName || '?').slice(0, 1).toUpperCase()}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <p className={clsx('text-lg font-semibold', !p.businessName && 'text-gray-300 dark:text-gray-600')}>{p.businessName || t('Your business')}</p>
          {pct === 100 && <Badge tone="green">{t('Verified')}</Badge>}
        </div>
        <p className="muted flex items-center gap-1.5 text-xs">
          <Globe className="h-3 w-3" /> {[p.country || t('Country'), p.industry && t(p.industry), p.founded && t('est. {year}', { year: p.founded })].filter(Boolean).join(' · ')}
        </p>
        <p className={clsx('mt-3 text-sm leading-relaxed', !p.description && 'text-gray-300 dark:text-gray-600')}>{p.description || t('Your description will appear here…')}</p>
        {p.primaryMaterials.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {p.primaryMaterials.map((m) => (
              <Badge key={m} tone="green">
                <Leaf className="h-3 w-3" /> {t(m)}
              </Badge>
            ))}
          </div>
        )}
        {p.circularModel && <p className="muted mt-3 text-xs">{t('Model: {model}', { model: t(p.circularModel) })}</p>}
        <div className="mt-4 flex items-center gap-3 border-t border-gray-100 pt-4 dark:border-white/5">
          <Avatar name={p.ownerName || '?'} src={p.avatar} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{p.ownerName || t('Your name')}</p>
            <p className="muted truncate text-xs">{p.role || t('Role')}</p>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-xs">
            <span className="muted">{t('Profile strength')}</span>
            <span className="font-semibold tabular-nums">{pct}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
            <div className="h-full rounded-full bg-brand-600 transition-all duration-500 dark:bg-brand-400" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

const TRACKED: (keyof BusinessProfile)[] = ['ownerName', 'email', 'role', 'businessName', 'country', 'founded', 'website', 'description', 'primaryMaterials', 'circularModel', 'annualRevenue', 'fundingGoal'];
export function completion(p: BusinessProfile) {
  const filled = TRACKED.filter((k) => {
    const v = p[k];
    return Array.isArray(v) ? v.length > 0 : typeof v === 'string' ? v.trim().length > 0 : !!v;
  }).length;
  return Math.round((filled / TRACKED.length) * 100);
}
