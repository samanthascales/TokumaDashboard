import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { Bell, Building2, Check, CircleUser, Globe, Laptop, Moon, Palette, RotateCcw, Sun, UserCog } from 'lucide-react';
import { ProfileEditor } from '../components/layout/ProfileEditor';
import { useStore } from '../store/AppStore';
import { useCloud } from '../store/CloudProvider';
import { AccountSettings } from './settings/AccountSettings';
import { Card, CardHeader, Modal, PageHeader, Toggle } from '../components/ui';
import { completion, ProfilePreview, STEPS, StepFields, stepValid, validate } from './onboarding/Steps';
import { emptyProfile } from '../data/defaults';
import type { BusinessProfile, NotificationPrefs, ThemePref } from '../types';
import { LANGUAGES, tk, useLang, useT } from '../i18n';

type Section = 'me' | 'account' | 'language' | 'appearance' | 'profile' | 'notifications';
const SECTIONS: Section[] = ['me', 'account', 'language', 'appearance', 'profile', 'notifications'];

export default function Settings() {
  const t = useT();
  const { lang, setLang } = useLang();
  const { themePref, setThemePref, profile, setProfile, prefs, setPrefs, resetData, toast } = useStore();
  const cloud = useCloud();
  const [params, setParams] = useSearchParams();
  const [section, setSection] = useState<Section>('me');
  // Links like /app/settings?section=account open that section.
  useEffect(() => {
    const s = params.get('section') as Section | null;
    if (s && SECTIONS.includes(s)) {
      setSection(s);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);
  const [draft, setDraft] = useState<BusinessProfile>(profile);
  const [touched, setTouched] = useState<Partial<Record<keyof BusinessProfile, boolean>>>({});
  const [confirmReset, setConfirmReset] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(profile);
  // Pick up changes saved elsewhere (e.g. the profile photo) unless there are unsaved edits here.
  useEffect(() => {
    if (!dirty) setDraft(profile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);
  const allValid = STEPS.every((s) => stepValid(s.key, draft));

  const set = <K extends keyof BusinessProfile>(k: K, v: BusinessProfile[K]) => {
    setDraft((x) => ({ ...x, [k]: v }));
    setTouched((x) => ({ ...x, [k]: true }));
  };

  const nav: { key: Section; label: string; icon: typeof Sun }[] = [
    { key: 'me', label: t('Your profile'), icon: CircleUser },
    ...(cloud.enabled ? [{ key: 'account' as const, label: t('Account & privacy'), icon: UserCog }] : []),
    { key: 'language', label: t('Language'), icon: Globe },
    { key: 'appearance', label: t('Appearance'), icon: Palette },
    { key: 'profile', label: t('Business profile'), icon: Building2 },
    { key: 'notifications', label: t('Notifications'), icon: Bell },
  ];

  const notifRows: { key: keyof NotificationPrefs; title: string; body: string }[] = [
    { key: 'lowStock', title: t('Low stock alerts'), body: t('When a product drops below its low-stock threshold') },
    { key: 'funding', title: t('Funding updates'), body: t('Status changes on loan, grant, equity and reward requests') },
    { key: 'supplier', title: t('Supplier alerts'), body: t('Late shipments and reliability score changes') },
    { key: 'insights', title: t('New AI insights'), body: t('When Tokuma finds a new optimization or opportunity') },
    { key: 'weeklyDigest', title: t('Weekly email digest'), body: t('A Monday summary of revenue, circularity and stock') },
  ];

  return (
    <>
      <PageHeader title={t('Settings')} sub={t('Language, theme, business profile and notification preferences')} />
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col">
          {nav.map((n) => (
            <button
              key={n.key}
              onClick={() => setSection(n.key)}
              className={clsx('flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition', section === n.key ? 'bg-white text-gray-900 shadow-card dark:bg-ink-900 dark:text-white' : 'text-gray-500 hover:bg-white/60 hover:text-gray-900 dark:hover:bg-white/[0.03] dark:hover:text-white')}
            >
              <n.icon className="h-4 w-4" /> {n.label}
            </button>
          ))}
        </nav>

        <div key={section} className="animate-page-in space-y-6">
          {section === 'language' && (
            <Card>
              <CardHeader title={t('Language')} sub={t('Choose the language for Tokuma on this device. Your data isn’t changed.')} />
              <div className="grid gap-2 p-5 sm:grid-cols-2" role="radiogroup" aria-label={t('Language')}>
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    role="radio"
                    aria-checked={lang === l.code}
                    lang={l.code}
                    onClick={() => setLang(l.code)}
                    className={clsx(
                      'flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-start transition',
                      lang === l.code ? 'border-brand-600 bg-brand-50/50 dark:border-brand-400 dark:bg-brand-500/[0.06]' : 'border-gray-200 hover:border-gray-300 dark:border-white/10',
                    )}
                  >
                    <span className="flex-1">
                      <span className="block text-sm font-semibold">{l.name}</span>
                      <span className="muted block text-xs">{l.english}</span>
                    </span>
                    {lang === l.code && <Check className="h-4 w-4 text-brand-600 dark:text-brand-400" />}
                  </button>
                ))}
              </div>
              {lang !== 'en' && <p className="muted px-5 pb-5 text-xs">{t('This translation is new. If something reads oddly, let us know so we can fix it.')}</p>}
            </Card>
          )}

          {section === 'appearance' && (
            <>
              <Card>
                <CardHeader title={t('Theme')} sub={t('Choose how Tokuma looks. System follows your OS setting.')} />
                <div className="grid gap-3 p-5 sm:grid-cols-3">
                  {(
                    [
                      ['light', tk('Light'), Sun],
                      ['dark', tk('Dark'), Moon],
                      ['system', tk('System'), Laptop],
                    ] as [ThemePref, string, typeof Sun][]
                  ).map(([v, label, Icon]) => (
                    <button key={v} onClick={() => setThemePref(v)} className={clsx('overflow-hidden rounded-xl border-2 text-start transition', themePref === v ? 'border-brand-600 dark:border-brand-400' : 'border-gray-200 hover:border-gray-300 dark:border-white/10')}>
                      <div className={clsx('flex h-24 gap-2 p-3', v === 'dark' ? 'bg-ink-950' : v === 'light' ? 'bg-gray-50' : 'bg-gradient-to-r from-gray-50 from-50% to-ink-950 to-50%')}>
                        <div className="w-1/4 rounded bg-ink-900" />
                        <div className="flex flex-1 flex-col gap-1.5">
                          <div className={clsx('h-3 w-2/3 rounded', v === 'dark' ? 'bg-ink-800' : 'bg-white shadow-sm')} />
                          <div className={clsx('flex-1 rounded', v === 'dark' ? 'bg-ink-800' : 'bg-white shadow-sm')} />
                          <div className="h-1.5 w-1/2 rounded bg-brand-500" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium">
                        <Icon className="h-4 w-4" /> {t(label)}
                      </div>
                    </button>
                  ))}
                </div>
              </Card>
              <Card>
                <CardHeader title={t('Your data')} sub={t('Permanently delete every product, supplier, transaction, customer and funding request, and clear your business profile.')} />
                <div className="p-5">
                  <button className="btn-secondary" onClick={() => setConfirmReset(true)}>
                    <RotateCcw className="h-4 w-4" /> {t('Delete all data')}
                  </button>
                </div>
              </Card>
            </>
          )}

          {section === 'profile' && (
            <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
              <div className="space-y-6">
                {STEPS.map((s) => (
                  <Card key={s.key}>
                    <CardHeader title={t(s.label)} />
                    <div className="p-5">
                      <StepFields step={s.key} p={draft} set={set} touched={touched} />
                    </div>
                  </Card>
                ))}
                <div className="sticky bottom-4 flex items-center justify-end gap-2 rounded-xl border border-gray-200 bg-white/90 p-3 shadow-lift backdrop-blur dark:border-white/10 dark:bg-ink-900/90">
                  <span className="muted me-auto text-xs">{dirty ? t('Unsaved changes') : t('All changes saved')}</span>
                  <button className="btn-ghost" disabled={!dirty} onClick={() => { setDraft(profile); setTouched({}); }}>
                    {t('Discard')}
                  </button>
                  <button
                    className="btn-primary"
                    disabled={!dirty}
                    onClick={() => {
                      if (!allValid) {
                        const keys = STEPS.flatMap((s) => Object.keys(validate(s.key, draft))) as (keyof BusinessProfile)[];
                        setTouched(Object.fromEntries(keys.map((k) => [k, true])));
                        toast({ kind: 'error', title: t('Fix the highlighted fields') });
                        return;
                      }
                      // Photo and phone are edited under Your profile; keep the saved ones.
                      setProfile({ ...draft, avatar: profile.avatar, phone: profile.phone });
                    }}
                  >
                    {t('Save profile')}
                  </button>
                </div>
              </div>
              <div className="xl:sticky xl:top-24 xl:self-start">
                <ProfilePreview p={draft} pct={completion(draft)} />
              </div>
            </div>
          )}

          {section === 'me' && (
            <Card>
              <CardHeader title={t('Your profile')} sub={t('How you appear in Tokuma and to investors')} />
              <div className="p-5">
                <ProfileEditor />
              </div>
            </Card>
          )}

          {section === 'account' && cloud.enabled && <AccountSettings />}

          {section === 'notifications' && (
            <Card>
              <CardHeader title={t('Notification preferences')} sub={t('Choose what shows up in your notification bell')} />
              <ul className="divide-y divide-gray-100 px-5 py-2 dark:divide-white/5">
                {notifRows.map((r) => (
                  <li key={r.key} className="flex items-center justify-between gap-4 py-4">
                    <div>
                      <p className="text-sm font-medium">{r.title}</p>
                      <p className="muted text-xs">{r.body}</p>
                    </div>
                    <Toggle
                      checked={prefs[r.key]}
                      label={r.title}
                      onChange={(v) => {
                        setPrefs({ ...prefs, [r.key]: v });
                        toast({ kind: 'success', title: v ? t('{name} on', { name: r.title }) : t('{name} off', { name: r.title }) });
                      }}
                    />
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        size="sm"
        title={t('Delete all data?')}
        sub={t("This clears everything you've entered and can't be undone.")}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setConfirmReset(false)}>
              {t('Cancel')}
            </button>
            <button
              className="btn-danger"
              onClick={() => {
                resetData();
                setDraft(emptyProfile);
                setConfirmReset(false);
              }}
            >
              {t('Delete everything')}
            </button>
          </>
        }
      >
        <p className="muted text-sm">{t('Your theme and language settings are kept. You can set up your business again from Settings or the dashboard checklist.')}</p>
      </Modal>
    </>
  );
}
