import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { ChevronDown, Sparkles, X } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { adminNavItem, businessNav, investorNav, type NavItem } from './nav';
import { useCloud } from '../../store/CloudProvider';
import { AnimatedNumber } from '../ui';
import { useT } from '../../i18n';
import { fmtPct } from '../../lib/format';

export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <div className={clsx('flex items-center gap-2.5', className)}>
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="8" fill="#0F6E56" />
        <path d="M16 7a9 9 0 1 0 9 9h-4a5 5 0 1 1-5-5z" fill="#fff" />
      </svg>
      <span className={clsx('text-[15px] font-semibold tracking-tight', light ? 'text-white' : '')}>Tokuma</span>
    </div>
  );
}

const OPEN_KEY = 'tokuma-nav-open';

function readOpenGroups(): string[] {
  try {
    return JSON.parse(localStorage.getItem(OPEN_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

function Item({ item, onNavigate, depth = 0 }: { item: NavItem; onNavigate?: () => void; depth?: number }) {
  const t = useT();
  const loc = useLocation();
  const inGroup = !!item.children && (loc.pathname === item.to || item.children.some((c) => loc.pathname.startsWith(c.to)));
  const childActive = item.children?.some((c) => loc.pathname.startsWith(c.to));
  // Groups (Products, Supply Chain) collapse; they open when you're on one of their pages
  // and remember whether you left them open.
  const [open, setOpen] = useState(() => inGroup || readOpenGroups().includes(item.to));
  useEffect(() => {
    if (inGroup) setOpen(true);
  }, [inGroup]);
  const toggle = () => {
    setOpen((o) => {
      const next = !o;
      try {
        const groups = new Set(readOpenGroups());
        if (next) groups.add(item.to);
        else groups.delete(item.to);
        localStorage.setItem(OPEN_KEY, JSON.stringify([...groups]));
      } catch {
        /* ignore */
      }
      return next;
    });
  };
  const Icon = item.icon;
  return (
    <li className="relative">
      <NavLink
        to={item.to}
        end={item.end}
        onClick={onNavigate}
        className={({ isActive }) =>
          clsx(
            'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors duration-150',
            depth ? 'ms-5 py-1.5 ps-4' : '',
            item.children && 'pe-9',
            isActive
              ? 'bg-white/[0.08] text-white'
              : childActive
                ? 'text-gray-200'
                : 'text-gray-400 hover:bg-white/[0.04] hover:text-gray-100',
          )
        }
      >
        {({ isActive }) => (
          <>
            {isActive && <span className="absolute start-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-e bg-brand-400" />}
            <Icon className={clsx('h-4 w-4 shrink-0', isActive ? 'text-brand-300' : 'text-gray-500 group-hover:text-gray-300')} />
            <span className="flex-1 truncate">{t(item.label)}</span>
            {item.badge === 'new' && <span className="rounded bg-brand-500/15 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-brand-300">{t('New')}</span>}
          </>
        )}
      </NavLink>
      {item.children && (
        <>
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-label={open ? t('Collapse {name}', { name: t(item.label) }) : t('Expand {name}', { name: t(item.label) })}
            className="absolute end-1.5 top-1 flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition hover:bg-white/[0.06] hover:text-gray-200"
          >
            <ChevronDown className={clsx('h-4 w-4 transition-transform duration-200', !open && '-rotate-90 rtl:rotate-90')} />
          </button>
          <div className={clsx('grid transition-[grid-template-rows] duration-200 ease-out', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
            <ul
              className="relative space-y-0.5 overflow-hidden before:absolute before:bottom-2 before:start-[1.35rem] before:top-1 before:w-px before:bg-white/10"
              // Keeps collapsed links out of Tab order and screen readers (React 18 types lack `inert`).
              {...({ inert: open ? undefined : '' } as object)}
            >
              <li className="h-0.5" aria-hidden />
              {item.children.map((c) => (
                <Item key={c.to} item={c} onNavigate={onNavigate} depth={depth + 1} />
              ))}
            </ul>
          </div>
        </>
      )}
    </li>
  );
}

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const { role, circ30, profile } = useStore();
  const { isAdmin } = useCloud();
  const base = role === 'investor' ? investorNav : businessNav;
  const nav = isAdmin ? [...base, adminNavItem] : base;
  return (
    <>
      <div className={clsx('fixed inset-0 z-40 bg-black/40 transition-opacity lg:hidden', open ? 'opacity-100' : 'pointer-events-none opacity-0')} onClick={onClose} />
      <aside
        className={clsx(
          'fixed inset-y-0 start-0 z-50 flex w-64 flex-col bg-ink-950 transition-transform duration-200 lg:translate-x-0 dark:border-e dark:border-white/5',
          open ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full lg:rtl:translate-x-0',
        )}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <Logo light />
          <button className="rounded-md p-1 text-gray-400 hover:text-white lg:hidden" onClick={onClose} aria-label={t('Close menu')}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mx-3 mb-3 rounded-lg bg-white/[0.04] px-3 py-2.5 ring-1 ring-white/5">
          <p className="truncate text-xs font-medium text-gray-200">{profile.businessName || t('Your business')}</p>
          <p className="text-[11px] text-gray-500">{role === 'investor' ? t('Investor view') : t('Business workspace')}</p>
        </div>
        <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 pb-4">
          <ul className="space-y-0.5">
            {nav.map((n) => (
              <Item key={n.to} item={n} onNavigate={onClose} />
            ))}
          </ul>
        </nav>
        <div className="m-3 rounded-xl bg-gradient-to-br from-brand-700/40 to-brand-900/30 p-4 ring-1 ring-brand-500/20">
          <div className="flex items-center gap-2 text-xs font-medium text-brand-200">
            <Sparkles className="h-3.5 w-3.5" /> {t('Circularity rate')}
          </div>
          <AnimatedNumber value={circ30.hasData ? circ30.rate : null} format={(n) => fmtPct(n)} className="mt-1 block text-2xl font-bold text-white" />
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-brand-400 transition-all duration-700" style={{ width: `${circ30.rate}%` }} />
          </div>
          <p className="mt-2 text-[11px] text-gray-400">{circ30.hasData ? t('Last 30 days · from sales × materials') : t('Log sales of products to calculate')}</p>
        </div>
      </aside>
    </>
  );
}
