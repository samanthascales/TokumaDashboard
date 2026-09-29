import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useStore } from '../store/AppStore';
import { Logo } from '../components/layout/Sidebar';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
    </svg>
  );
}

export default function SignIn() {
  const [params] = useSearchParams();
  const portal = params.get('portal') === 'investor' ? 'investor' : 'business';
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setRole } = useStore();

  const go = () => {
    setLoading(true);
    setTimeout(() => {
      setRole(portal);
      navigate(portal === 'investor' ? '/app/investor' : '/onboarding');
    }, 900);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-ink-950">
      <div className="card w-full max-w-sm animate-pop-in p-8 text-center">
        <Logo className="justify-center" />
        <h1 className="mt-6 text-xl font-semibold">Sign in to the {portal} portal</h1>
        <p className="muted mt-1 text-sm">Use your work Google account to continue.</p>
        <button className="btn-secondary mt-6 w-full py-2.5" onClick={go} disabled={loading}>
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleIcon />}
          {loading ? 'Signing in…' : 'Continue with Google'}
        </button>
        <p className="muted mt-6 text-xs">
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
        <Link to="/app" className="mt-2 block text-xs text-gray-400 hover:text-gray-600" onClick={() => setRole('business')}>
          Skip to demo dashboard
        </Link>
      </div>
    </div>
  );
}
