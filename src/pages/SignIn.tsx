import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { Loader2, MailCheck } from 'lucide-react';
import { useStore } from '../store/AppStore';
import { useCloud } from '../store/CloudProvider';
import { Logo } from '../components/layout/Sidebar';
import { Field, Segmented } from '../components/ui';
import { friendlyError, sendPasswordReset, signIn, signUp } from '../lib/cloud';

type Mode = 'signin' | 'signup' | 'reset';

export default function SignIn() {
  const [params] = useSearchParams();
  const portal = params.get('portal') === 'investor' ? 'investor' : 'business';
  const navigate = useNavigate();
  const { setRole } = useStore();
  const cloud = useCloud();
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'signup' ? 'signup' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<null | 'confirm' | 'reset'>(null);
  const [justSignedUp, setJustSignedUp] = useState(false);

  useEffect(() => {
    setError(null);
    setSent(null);
  }, [mode]);
  // Follow ?mode=signup links even when this page is already open.
  const modeParam = params.get('mode');
  useEffect(() => {
    setMode(modeParam === 'signup' ? 'signup' : 'signin');
  }, [modeParam]);

  // Once signed in and the account's data is loaded, go into the app.
  const ready = cloud.enabled && !!cloud.user && cloud.dataReady;
  useEffect(() => {
    if (!ready) return;
    setRole(portal);
    navigate(justSignedUp && portal === 'business' ? '/onboarding' : portal === 'investor' ? '/app/investor' : '/app', { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError('Enter a valid email address.');
    if (mode !== 'reset' && password.length < 8) return setError('Use a password of at least 8 characters.');
    setBusy(true);
    try {
      if (mode === 'signin') await signIn(email, password);
      else if (mode === 'signup') {
        const res = await signUp(email, password);
        setJustSignedUp(true);
        // No session means Supabase is waiting for the email to be confirmed.
        if (!res.session) setSent('confirm');
      } else {
        await sendPasswordReset(email);
        setSent('reset');
      }
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-ink-950">
      <div className="card w-full max-w-sm animate-pop-in p-8">
        <Link to="/" className="flex justify-center">
          <Logo />
        </Link>

        {!cloud.enabled ? (
          <div className="text-center">
            <h1 className="mt-6 text-xl font-semibold">Open the {portal} portal</h1>
            <p className="muted mt-2 text-sm">Accounts aren’t switched on for this site yet. Your data will be saved in this browser only.</p>
            <button
              className="btn-primary mt-6 w-full py-2.5"
              onClick={() => {
                setRole(portal);
                navigate(portal === 'investor' ? '/app/investor' : '/onboarding');
              }}
            >
              Continue
            </button>
          </div>
        ) : sent ? (
          <div className="text-center">
            <MailCheck className="mx-auto mt-6 h-10 w-10 text-brand-600 dark:text-brand-400" />
            <h1 className="mt-3 text-lg font-semibold">Check your email</h1>
            <p className="muted mt-2 text-sm">
              {sent === 'confirm' ? (
                <>
                  We sent a confirmation link to <b className="text-gray-900 dark:text-white">{email}</b>. Open it on this device, then sign in.
                </>
              ) : (
                <>
                  If <b className="text-gray-900 dark:text-white">{email}</b> has an account, we sent a link to choose a new password.
                </>
              )}
            </p>
            <button className="btn-secondary mt-6 w-full" onClick={() => setMode('signin')}>
              Back to sign in
            </button>
          </div>
        ) : cloud.user ? (
          <div className="mt-8 flex flex-col items-center gap-3 text-sm">
            {cloud.loadError ? (
              <>
                <p className="text-center text-red-600 dark:text-red-400">{cloud.loadError}</p>
                <button className="btn-secondary" onClick={() => cloud.reload()}>
                  Try again
                </button>
              </>
            ) : (
              <>
                <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
                Loading your workspace…
              </>
            )}
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <h1 className="mt-6 text-center text-xl font-semibold">{mode === 'signup' ? 'Create your account' : mode === 'reset' ? 'Reset your password' : 'Sign in'}</h1>
            <p className="muted mt-1 text-center text-sm">{portal === 'investor' ? 'Investor portal' : 'Business portal'}</p>
            {mode !== 'reset' && (
              <Segmented
                className="mt-5 flex w-full [&>button]:flex-1"
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'signin', label: 'Sign in' },
                  { value: 'signup', label: 'Create account' },
                ]}
              />
            )}
            <div className="mt-5 space-y-4">
              <Field label="Email">
                <input id="auth-email" type="email" autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              {mode !== 'reset' && (
                <Field label="Password" hint={mode === 'signup' ? 'At least 8 characters' : undefined}>
                  <input id="auth-password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
                </Field>
              )}
            </div>
            {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
            <button type="submit" className="btn-primary mt-5 w-full py-2.5" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Sign in'}
            </button>
            <p className="muted mt-4 text-center text-xs">
              {mode === 'signin' ? (
                <button type="button" className="font-medium text-brand-700 hover:underline dark:text-brand-400" onClick={() => setMode('reset')}>
                  Forgot password?
                </button>
              ) : mode === 'reset' ? (
                <button type="button" className="font-medium text-brand-700 hover:underline dark:text-brand-400" onClick={() => setMode('signin')}>
                  Back to sign in
                </button>
              ) : (
                <>By creating an account you agree to Tokuma storing your business data to provide the service.</>
              )}
            </p>
          </form>
        )}

        <p className={clsx('muted mt-6 text-center text-xs')}>
          {portal === 'business' ? (
            <>
              Investor? <Link className="font-medium text-brand-700 hover:underline dark:text-brand-400" to="/signin?portal=investor">Use the investor portal</Link>
            </>
          ) : (
            <>
              Running a business? <Link className="font-medium text-brand-700 hover:underline dark:text-brand-400" to="/signin?portal=business">Use the business portal</Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
