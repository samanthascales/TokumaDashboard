import { useState, type FormEvent, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, Loader2, LogOut } from 'lucide-react';
import { useCloud } from '../../store/CloudProvider';
import { useStore } from '../../store/AppStore';
import { friendlyError, updatePassword } from '../../lib/cloud';
import { Field, Modal } from '../ui';
import { useT } from '../../i18n';

/** With accounts on, keeps signed-out visitors out of the app and waits for their data to load. */
export function RequireAccount({ children }: { children: ReactNode }) {
  const t = useT();
  const cloud = useCloud();
  const loc = useLocation();
  if (!cloud.enabled) return <>{children}</>;
  if (!cloud.authReady || (cloud.user && !cloud.dataReady && !cloud.loadError)) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 text-sm text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin text-brand-600" /> {t('Loading your workspace…')}
      </div>
    );
  }
  if (!cloud.user || cloud.loadError) return <Navigate to={`/signin?next=${encodeURIComponent(loc.pathname)}`} replace />;
  return <>{children}</>;
}

/** Shown after following a password-reset email link. */
export function PasswordRecovery() {
  const t = useT();
  const cloud = useCloud();
  const { toast } = useStore();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return setError(t('Use a password of at least 8 characters.'));
    setBusy(true);
    try {
      await updatePassword(pw);
      cloud.clearRecovery();
      toast({ kind: 'success', title: t('Password updated') });
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={cloud.recovery}
      onClose={cloud.clearRecovery}
      size="sm"
      title={t('Choose a new password')}
      footer={
        <button className="btn-primary" form="recovery-form" disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} {t('Save password')}
        </button>
      }
    >
      <form id="recovery-form" onSubmit={submit}>
        <Field label={t('New password')} error={error} hint={t('At least 8 characters')}>
          <input id="recovery-password" type="password" autoComplete="new-password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}

/** Sticky banner while the owner is looking at another business's data. */
export function SupportBanner() {
  const t = useT();
  const cloud = useCloud();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  if (!cloud.supportView) return null;
  return (
    <div className="sticky top-0 z-40 flex flex-wrap items-center gap-3 bg-amber-400 px-4 py-2 text-sm font-medium text-amber-950 sm:px-6">
      <Eye className="h-4 w-4" />
      <span className="flex-1">
        {t('Support view:')} <b>{cloud.supportView.name || t('Unnamed business')}</b> — {t('read-only. Changes you make here aren’t saved.')}
      </span>
      <button
        className="inline-flex items-center gap-1.5 rounded-md bg-amber-950/10 px-2.5 py-1 hover:bg-amber-950/20"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await cloud.exitSupportView();
          setBusy(false);
          navigate('/app/admin');
        }}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />} {t('Exit support view')}
      </button>
    </div>
  );
}
