import { useState } from 'react';
import clsx from 'clsx';
import { Bell, Building2, Laptop, Moon, Palette, RotateCcw, Sun } from 'lucide-react';
import { useStore } from '../store/AppStore';
import { Card, CardHeader, Modal, PageHeader, Toggle } from '../components/ui';
import { completion, ProfilePreview, STEPS, StepFields, stepValid, validate } from './onboarding/Steps';
import { emptyProfile } from '../data/defaults';
import type { BusinessProfile, NotificationPrefs, ThemePref } from '../types';

type Section = 'appearance' | 'profile' | 'notifications';

export default function Settings() {
  const { themePref, setThemePref, profile, setProfile, prefs, setPrefs, resetData, toast } = useStore();
  const [section, setSection] = useState<Section>('appearance');
  const [draft, setDraft] = useState<BusinessProfile>(profile);
  const [touched, setTouched] = useState<Partial<Record<keyof BusinessProfile, boolean>>>({});
  const [confirmReset, setConfirmReset] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(profile);
  const allValid = STEPS.every((s) => stepValid(s.key, draft));

  const set = <K extends keyof BusinessProfile>(k: K, v: BusinessProfile[K]) => {
    setDraft((x) => ({ ...x, [k]: v }));
    setTouched((t) => ({ ...t, [k]: true }));
  };

  const nav: { key: Section; label: string; icon: typeof Sun }[] = [
    { key: 'appearance', label: 'Appearance', icon: Palette },
    { key: 'profile', label: 'Business profile', icon: Building2 },
    { key: 'notifications', label: 'Notifications', icon: Bell },
  ];

  const notifRows: { key: keyof NotificationPrefs; title: string; body: string }[] = [
    { key: 'lowStock', title: 'Low stock alerts', body: 'When a product drops below its low-stock threshold' },
    { key: 'funding', title: 'Funding updates', body: 'Status changes on loan, grant, equity and reward requests' },
    { key: 'supplier', title: 'Supplier alerts', body: 'Late shipments and reliability score changes' },
    { key: 'insights', title: 'New AI insights', body: 'When Tokuma finds a new optimization or opportunity' },
    { key: 'weeklyDigest', title: 'Weekly email digest', body: 'A Monday summary of revenue, circularity and stock' },
  ];

  return (
    <>
      <PageHeader title="Settings" sub="Theme, business profile and notification preferences" />
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
          {section === 'appearance' && (
            <>
              <Card>
                <CardHeader title="Theme" sub="Choose how Tokuma looks. System follows your OS setting." />
                <div className="grid gap-3 p-5 sm:grid-cols-3">
                  {(
                    [
                      ['light', 'Light', Sun],
                      ['dark', 'Dark', Moon],
                      ['system', 'System', Laptop],
                    ] as [ThemePref, string, typeof Sun][]
                  ).map(([v, label, Icon]) => (
                    <button key={v} onClick={() => setThemePref(v)} className={clsx('overflow-hidden rounded-xl border-2 text-left transition', themePref === v ? 'border-brand-600 dark:border-brand-400' : 'border-gray-200 hover:border-gray-300 dark:border-white/10')}>
                      <div className={clsx('flex h-24 gap-2 p-3', v === 'dark' ? 'bg-ink-950' : v === 'light' ? 'bg-gray-50' : 'bg-gradient-to-r from-gray-50 from-50% to-ink-950 to-50%')}>
                        <div className="w-1/4 rounded bg-ink-900" />
                        <div className="flex flex-1 flex-col gap-1.5">
                          <div className={clsx('h-3 w-2/3 rounded', v === 'dark' ? 'bg-ink-800' : 'bg-white shadow-sm')} />
                          <div className={clsx('flex-1 rounded', v === 'dark' ? 'bg-ink-800' : 'bg-white shadow-sm')} />
                          <div className="h-1.5 w-1/2 rounded bg-brand-500" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium">
                        <Icon className="h-4 w-4" /> {label}
                      </div>
                    </button>
                  ))}
                </div>
              </Card>
              <Card>
                <CardHeader title="Your data" sub="Permanently delete every product, supplier, transaction, customer and funding request, and clear your business profile." />
                <div className="p-5">
                  <button className="btn-secondary" onClick={() => setConfirmReset(true)}>
                    <RotateCcw className="h-4 w-4" /> Delete all data
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
                    <CardHeader title={s.label} />
                    <div className="p-5">
                      <StepFields step={s.key} p={draft} set={set} touched={touched} />
                    </div>
                  </Card>
                ))}
                <div className="sticky bottom-4 flex items-center justify-end gap-2 rounded-xl border border-gray-200 bg-white/90 p-3 shadow-lift backdrop-blur dark:border-white/10 dark:bg-ink-900/90">
                  <span className="muted mr-auto text-xs">{dirty ? 'Unsaved changes' : 'All changes saved'}</span>
                  <button className="btn-ghost" disabled={!dirty} onClick={() => { setDraft(profile); setTouched({}); }}>
                    Discard
                  </button>
                  <button
                    className="btn-primary"
                    disabled={!dirty}
                    onClick={() => {
                      if (!allValid) {
                        const keys = STEPS.flatMap((s) => Object.keys(validate(s.key, draft))) as (keyof BusinessProfile)[];
                        setTouched(Object.fromEntries(keys.map((k) => [k, true])));
                        toast({ kind: 'error', title: 'Fix the highlighted fields' });
                        return;
                      }
                      setProfile(draft);
                    }}
                  >
                    Save profile
                  </button>
                </div>
              </div>
              <div className="xl:sticky xl:top-24 xl:self-start">
                <ProfilePreview p={draft} pct={completion(draft)} />
              </div>
            </div>
          )}

          {section === 'notifications' && (
            <Card>
              <CardHeader title="Notification preferences" sub="Choose what shows up in your notification bell" />
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
                        toast({ kind: 'success', title: `${r.title} ${v ? 'on' : 'off'}` });
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
        title="Delete all data?"
        sub="This clears everything you've entered and can't be undone."
        footer={
          <>
            <button className="btn-secondary" onClick={() => setConfirmReset(false)}>
              Cancel
            </button>
            <button
              className="btn-danger"
              onClick={() => {
                resetData();
                setDraft(emptyProfile);
                setConfirmReset(false);
              }}
            >
              Delete everything
            </button>
          </>
        }
      >
        <p className="muted text-sm">Your theme setting is kept. You can set up your business again from Settings or the dashboard checklist.</p>
      </Modal>
    </>
  );
}
