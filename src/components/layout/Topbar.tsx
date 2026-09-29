import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { AlertTriangle, Bell, BriefcaseBusiness, Check, ChevronDown, Landmark, LogOut, Menu, Moon, Search, Settings, Sparkles, Store, Sun, Truck } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { useOnClickOutside } from '../../lib/hooks';
import { fmtRelative } from '../../lib/format';
import { Avatar } from '../ui';
import type { AppNotification } from '../../types';

const notifIcon: Record<AppNotification['kind'], typeof Bell> = {
  stock: AlertTriangle,
  funding: Landmark,
  supplier: Truck,
  insight: Sparkles,
  system: Check,
};

function Notifications() {
  const { notifications, markAllRead, markRead, prefs } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useOnClickOutside(ref, close, open);
  const navigate = useNavigate();
  const visible = notifications.filter(
    (n) => (n.kind !== 'stock' || prefs.lowStock) && (n.kind !== 'funding' || prefs.funding) && (n.kind !== 'supplier' || prefs.supplier) && (n.kind !== 'insight' || prefs.insights),
  );
  const unread = visible.filter((n) => !n.read).length;
  return (
    <div className="relative" ref={ref}>
      <button className="icon-btn relative" onClick={() => setOpen((o) => !o)} aria-label={`Notifications (${unread} unread)`}>
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold text-white ring-2 ring-white dark:ring-ink-950">{unread}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-[22rem] max-w-[calc(100vw-2rem)] animate-pop-in overflow-hidden rounded-xl border border-gray-200 bg-white shadow-pop dark:border-white/10 dark:bg-ink-850">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-white/5">
            <p className="text-sm font-semibold">Notifications</p>
            <button className="text-xs font-medium text-brand-600 hover:underline disabled:opacity-40 dark:text-brand-400" onClick={markAllRead} disabled={!unread}>
              Mark all read
            </button>
          </div>
          <ul className="scrollbar-thin max-h-96 overflow-y-auto">
            {visible.length === 0 && <li className="muted px-4 py-10 text-center text-sm">You're all caught up.</li>}
            {visible.map((n) => {
              const Icon = notifIcon[n.kind];
              return (
                <li key={n.id}>
                  <button
                    className="flex w-full gap-3 px-4 py-3 text-left transition hover:bg-gray-50 dark:hover:bg-white/[0.03]"
                    onClick={() => {
                      markRead(n.id);
                      setOpen(false);
                      if (n.to) navigate(n.to);
                    }}
                  >
                    <span className={clsx('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', n.kind === 'stock' ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400' : 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300')}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className={clsx('truncate text-sm', n.read ? 'font-medium text-gray-700 dark:text-gray-300' : 'font-semibold')}>{n.title}</span>
                        {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />}
                      </span>
                      <span className="muted mt-0.5 line-clamp-2 block text-xs">{n.body}</span>
                      <span className="mt-1 block text-[11px] text-gray-400">{fmtRelative(n.date)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function RoleSwitcher() {
  const { role, setRole, profile } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useOnClickOutside(ref, close, open);
  const navigate = useNavigate();
  const choose = (r: 'business' | 'investor') => {
    setRole(r);
    setOpen(false);
    navigate(r === 'investor' ? '/app/investor' : '/app');
  };
  return (
    <div className="relative" ref={ref}>
      <button className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition hover:bg-gray-100 dark:hover:bg-white/5" onClick={() => setOpen((o) => !o)}>
        <Avatar name={profile.ownerName} />
        <span className="hidden text-left leading-tight md:block">
          <span className="block text-[13px] font-medium">{profile.ownerName}</span>
          <span className="block text-[11px] text-gray-500 dark:text-gray-400">{role === 'investor' ? 'Investor' : 'Business'}</span>
        </span>
        <ChevronDown className="hidden h-4 w-4 text-gray-400 md:block" />
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-64 animate-pop-in overflow-hidden rounded-xl border border-gray-200 bg-white p-1.5 shadow-pop dark:border-white/10 dark:bg-ink-850">
          <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Switch portal</p>
          {(
            [
              ['business', Store, 'Business', 'Run operations & track circularity'],
              ['investor', BriefcaseBusiness, 'Investor', 'Review impact & funding readiness'],
            ] as const
          ).map(([r, Icon, label, sub]) => (
            <button key={r} onClick={() => choose(r)} className={clsx('flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left transition hover:bg-gray-50 dark:hover:bg-white/5', role === r && 'bg-gray-50 dark:bg-white/5')}>
              <Icon className="mt-0.5 h-4 w-4 text-gray-500" />
              <span className="flex-1">
                <span className="block text-sm font-medium">{label}</span>
                <span className="muted block text-xs">{sub}</span>
              </span>
              {role === r && <Check className="mt-0.5 h-4 w-4 text-brand-600 dark:text-brand-400" />}
            </button>
          ))}
          <div className="my-1.5 h-px bg-gray-100 dark:bg-white/5" />
          <button onClick={() => { setOpen(false); navigate('/app/settings'); }} className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm hover:bg-gray-50 dark:hover:bg-white/5">
            <Settings className="h-4 w-4 text-gray-500" /> Settings
          </button>
          <button onClick={() => navigate('/')} className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm hover:bg-gray-50 dark:hover:bg-white/5">
            <LogOut className="h-4 w-4 text-gray-500" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function Topbar({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  const { theme, setThemePref } = useStore();
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-gray-200/80 bg-white/80 px-4 backdrop-blur-md dark:border-white/5 dark:bg-ink-950/80 sm:px-6">
      <button className="icon-btn lg:hidden" onClick={onMenu} aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </button>
      <button
        onClick={onSearch}
        className="flex h-9 w-full max-w-md items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-400 transition hover:border-gray-300 hover:bg-white dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/20"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 truncate text-left">Search products, suppliers, pages…</span>
        <kbd className="hidden rounded border border-gray-200 bg-white px-1.5 py-0.5 font-sans text-[11px] font-medium text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400 sm:inline">{isMac ? '⌘' : 'Ctrl'} K</kbd>
      </button>
      <div className="ml-auto flex items-center gap-1">
        <button className="icon-btn" onClick={() => setThemePref(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
          {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>
        <Notifications />
        <div className="mx-1 h-6 w-px bg-gray-200 dark:bg-white/10" />
        <RoleSwitcher />
      </div>
    </header>
  );
}
