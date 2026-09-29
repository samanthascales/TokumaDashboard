import { Link } from 'react-router-dom';
import { ArrowRight, BriefcaseBusiness, Leaf, ShieldCheck, Store } from 'lucide-react';
import { Logo } from '../components/layout/Sidebar';
import { useCloud } from '../store/CloudProvider';

export default function Landing() {
  const cloud = useCloud();
  return (
    <div className="relative min-h-screen overflow-hidden bg-white dark:bg-ink-950">
      <div
        className="absolute inset-0 animate-gradient opacity-70 dark:opacity-40"
        style={{
          backgroundImage: 'radial-gradient(60% 50% at 20% 10%, rgba(29,158,117,0.18), transparent 60%), radial-gradient(50% 50% at 90% 30%, rgba(93,202,165,0.18), transparent 60%), linear-gradient(120deg, #f7faf9, #eef6f2, #f7faf9, #e8f5f0)',
          backgroundSize: '100% 100%, 100% 100%, 300% 300%',
        }}
      />
      <div className="absolute inset-0 hidden animate-gradient dark:block" style={{ backgroundImage: 'radial-gradient(60% 50% at 20% 10%, rgba(29,158,117,0.18), transparent 60%), linear-gradient(120deg, #0D110F, #10201a, #0D110F)', backgroundSize: '100% 100%, 300% 300%' }} />
      <div className="relative">
        <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Logo />
          {cloud.user ? (
            <Link to="/app" className="btn-primary btn-sm">
              Open dashboard
            </Link>
          ) : (
            <Link to="/signin" className="btn-secondary btn-sm">
              Sign in
            </Link>
          )}
        </header>
        <main className="mx-auto max-w-6xl px-6 pb-20 pt-14 text-center sm:pt-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/70 px-3 py-1 text-xs font-medium text-brand-800 backdrop-blur dark:border-brand-500/30 dark:bg-white/5 dark:text-brand-200">
            <Leaf className="h-3.5 w-3.5" /> The circular economy ERP
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
            Run your business. <span className="text-brand-600 dark:text-brand-400">Prove your impact.</span> Unlock capital.
          </h1>
          <p className="muted mx-auto mt-5 max-w-xl text-lg">Tokuma turns everyday operations — sales, materials, suppliers — into a verified circularity score that lenders and investors trust.</p>
          <p className="mt-6 inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <span className="h-2 w-2 rounded-full bg-brand-500" /> Now in early access — set up your business in a few minutes
          </p>

          <div className="mx-auto mt-12 grid max-w-4xl gap-5 text-left md:grid-cols-2">
            {[
              { to: '/signin?portal=business', icon: Store, title: 'For businesses', body: 'Track products, inventory, suppliers and circularity in one place — and get funded on your data.', cta: 'Open business portal', points: ['Live circularity from sales', 'Inventory & supplier reliability', 'AI circular insights'] },
              { to: '/signin?portal=investor', icon: BriefcaseBusiness, title: 'For investors', body: 'Discover verified circular businesses and review impact, reliability and funding readiness.', cta: 'Open investor portal', points: ['Verified impact data', 'Supplier risk visibility', 'One-click reports'] },
            ].map((c) => (
              <Link key={c.title} to={c.to} className="card card-hover group relative overflow-hidden p-6 transition hover:-translate-y-1">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
                  <c.icon className="h-5 w-5" />
                </span>
                <h2 className="mt-4 text-lg font-semibold">{c.title}</h2>
                <p className="muted mt-1 text-sm">{c.body}</p>
                <ul className="mt-4 space-y-1.5 text-sm">
                  {c.points.map((p) => (
                    <li key={p} className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-brand-600 dark:text-brand-400" /> {p}
                    </li>
                  ))}
                </ul>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 dark:text-brand-400">
                  {c.cta} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
