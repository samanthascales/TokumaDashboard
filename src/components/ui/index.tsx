import { useEffect, useId, useRef, useState, type HTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { ArrowDownRight, ArrowUpRight, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useCountUp } from '../../lib/hooks';
import { useStore } from '../../store/AppStore';

export { clsx };

/* ---------------- Card ---------------- */

export function Card({ className, children, hover, ...rest }: { className?: string; children: ReactNode; hover?: boolean } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx('card', hover && 'card-hover', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, sub, right, className }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={clsx('flex items-start justify-between gap-3 px-5 pt-4', className)}>
      <div className="min-w-0">
        <h3 className="card-title">{title}</h3>
        {sub && <p className="card-sub mt-0.5">{sub}</p>}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  );
}

export function PageHeader({ title, sub, actions, children }: { title: string; sub?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {sub && <p className="muted mt-1 text-sm">{sub}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

/* ---------------- Badge ---------------- */

type Tone = 'green' | 'amber' | 'red' | 'gray' | 'blue';
const toneCls: Record<Tone, string> = {
  green: 'bg-brand-50 text-brand-700 ring-brand-600/15 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-400/20',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/15 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20',
  red: 'bg-red-50 text-red-700 ring-red-600/15 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/20',
  gray: 'bg-gray-100 text-gray-600 ring-gray-500/10 dark:bg-white/5 dark:text-gray-300 dark:ring-white/10',
  blue: 'bg-sky-50 text-sky-700 ring-sky-600/15 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/20',
};

export function Badge({ tone = 'gray', children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset', toneCls[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function Delta({ value, suffix = '%', invert, className }: { value: number; suffix?: string; invert?: boolean; className?: string }) {
  const good = invert ? value < 0 : value > 0;
  const flat = Math.abs(value) < 0.05;
  const Icon = value >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums',
        flat ? 'text-gray-500' : good ? 'text-brand-600 dark:text-brand-400' : 'text-red-600 dark:text-red-400',
        className,
      )}
    >
      {!flat && <Icon className="h-3.5 w-3.5" />}
      {flat ? '0.0' : Math.abs(value).toFixed(1)}
      {suffix}
    </span>
  );
}

/* ---------------- Animated number ---------------- */

/** Counts up to `value`. Pass null when there's no real data yet — it shows "—" instead of a number. */
export function AnimatedNumber({ value, format, duration, className }: { value: number | null; format: (n: number) => string; duration?: number; className?: string }) {
  const v = useCountUp(value ?? 0, duration);
  if (value === null) return <span className={clsx('tabular-nums text-gray-300 dark:text-gray-600', className)}>—</span>;
  return <span className={clsx('tabular-nums', className)}>{format(v)}</span>;
}

/* ---------------- Skeleton ---------------- */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={clsx('relative overflow-hidden rounded-md bg-gray-100 dark:bg-white/5', className)}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-white/5" />
    </div>
  );
}

export function CardSkeleton({ className, lines = 3, chart }: { className?: string; lines?: number; chart?: boolean }) {
  return (
    <div className={clsx('card p-5', className)}>
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="mt-2 h-3 w-1/2" />
      {chart ? (
        <Skeleton className="mt-5 h-[calc(100%-3.5rem)] min-h-[160px] w-full" />
      ) : (
        <div className="mt-5 space-y-3">
          {Array.from({ length: lines }).map((_, i) => (
            <Skeleton key={i} className="h-3" />
          ))}
        </div>
      )}
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-gray-100 p-4 dark:border-white/5">
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="divide-y divide-gray-100 dark:divide-white/5">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="grid gap-4 px-4 py-3.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-3" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Empty state ---------------- */

export function EmptyState({ icon, title, body, action, className }: { icon: ReactNode; title: string; body?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={clsx('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <div className="relative mb-4">
        <svg width="120" height="84" viewBox="0 0 120 84" fill="none" className="text-gray-200 dark:text-white/10" aria-hidden>
          <rect x="10" y="18" width="100" height="58" rx="10" fill="currentColor" opacity=".45" />
          <rect x="22" y="8" width="76" height="58" rx="10" fill="currentColor" opacity=".7" />
          <circle cx="98" cy="14" r="4" className="fill-brand-200 dark:fill-brand-500/30" />
          <circle cx="14" cy="70" r="3" className="fill-brand-200 dark:fill-brand-500/30" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center pb-4 text-brand-600 dark:text-brand-400">{icon}</div>
      </div>
      <h4 className="text-sm font-semibold">{title}</h4>
      {body && <p className="muted mt-1 max-w-sm text-sm">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------------- Segmented control ---------------- */

export function Segmented<T extends string>({ options, value, onChange, className }: { options: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={clsx('seg', className)} role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} className={clsx('seg-btn', o.value === value && 'seg-btn-active')} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 border-b border-gray-200 dark:border-white/10">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={clsx(
            '-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition',
            t.value === value ? 'border-brand-600 text-gray-900 dark:border-brand-400 dark:text-white' : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200',
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="rounded-full bg-gray-100 px-1.5 text-[11px] tabular-nums text-gray-600 dark:bg-white/10 dark:text-gray-300">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Toggle ---------------- */

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={clsx('relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition', checked ? 'bg-brand-600' : 'bg-gray-300 dark:bg-white/15')}
    >
      <span className={clsx('inline-block h-4 w-4 transform rounded-full bg-white shadow transition', checked ? 'translate-x-[18px]' : 'translate-x-0.5')} />
    </button>
  );
}

/* ---------------- Hover tip ---------------- */

export function Tip({ content, children, className, side = 'top' }: { content: ReactNode; children: ReactNode; className?: string; side?: 'top' | 'bottom' }) {
  return (
    <span className={clsx('group/tip relative inline-flex', className)}>
      {children}
      <span
        role="tooltip"
        className={clsx(
          'pointer-events-none absolute left-1/2 z-40 w-max max-w-[240px] -translate-x-1/2 rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-normal leading-relaxed text-white opacity-0 shadow-lg transition duration-150 group-hover/tip:opacity-100 dark:bg-ink-700',
          side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
        )}
      >
        {content}
      </span>
    </span>
  );
}

/* ---------------- Modal ---------------- */

export function Modal({ open, onClose, title, sub, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: ReactNode; sub?: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', h);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  const w = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size];
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal aria-labelledby={id}>
      <div className="absolute inset-0 animate-fade-in bg-gray-950/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={clsx('relative flex max-h-[92vh] w-full animate-pop-in flex-col rounded-t-2xl bg-white shadow-pop dark:bg-ink-900 dark:ring-1 dark:ring-white/10 sm:rounded-2xl', w)}>
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-4 dark:border-white/5">
          <div>
            <h2 id={id} className="text-base font-semibold">
              {title}
            </h2>
            {sub && <p className="muted mt-0.5 text-sm">{sub}</p>}
          </div>
          <button className="icon-btn -mr-2 h-8 w-8" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="scrollbar-thin overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-3.5 dark:border-white/5">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ---------------- Toasts ---------------- */

export function Toaster() {
  const { toasts, dismissToast } = useStore();
  return createPortal(
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
      {toasts.map((t) => {
        const Icon = t.kind === 'success' ? CheckCircle2 : t.kind === 'error' ? XCircle : Info;
        return (
          <div key={t.id} className="pointer-events-auto flex animate-toast-in items-start gap-3 rounded-xl border border-gray-200 bg-white p-3.5 shadow-pop dark:border-white/10 dark:bg-ink-850">
            <Icon className={clsx('mt-0.5 h-5 w-5 shrink-0', t.kind === 'success' ? 'text-brand-600 dark:text-brand-400' : t.kind === 'error' ? 'text-red-500' : 'text-gray-500')} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{t.title}</p>
              {t.body && <p className="muted mt-0.5 text-xs">{t.body}</p>}
            </div>
            <button className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" onClick={() => dismissToast(t.id)} aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}

/* ---------------- Sparkline (pure SVG, light) ---------------- */

export function Sparkline({ data, className, height = 36 }: { data: number[]; className?: string; height?: number }) {
  const gid = useId().replace(/:/g, '');
  if (data.length < 2) return null;
  const w = 100;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, height - 3 - ((v - min) / span) * (height - 6)] as const);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const last = pts[pts.length - 1]!;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className={clsx('h-9 w-full overflow-visible', className)} aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.18} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`${d} L${w},${height} L0,${height} Z`} fill={`url(#${gid})`} />
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.75} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={2.5} fill="currentColor" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/* ---------------- Stock bar ---------------- */

export function StockBar({ stock, threshold, reorderPoint, compact }: { stock: number; threshold: number; reorderPoint: number | null; compact?: boolean }) {
  const rop = reorderPoint ?? 0;
  const max = Math.max(stock, rop * 2.2, threshold * 3, 1);
  const pct = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  const status = stock <= threshold ? 'critical' : reorderPoint !== null && stock <= reorderPoint ? 'reorder' : 'healthy';
  const fill = status === 'critical' ? 'bg-red-500' : status === 'reorder' ? 'bg-amber-400' : 'bg-brand-500';
  return (
    <div className={clsx('w-full', compact ? 'min-w-[120px]' : '')}>
      <div className="relative h-2 w-full overflow-visible rounded-full bg-gray-100 dark:bg-white/[0.06]">
        <div className={clsx('h-full rounded-full transition-all duration-700 ease-out', fill)} style={{ width: pct(stock) }} />
        {threshold > 0 && <span className="absolute -top-1 h-4 w-0.5 -translate-x-1/2 rounded bg-red-400/80" style={{ left: pct(threshold) }} title={`Low-stock threshold: ${threshold}`} />}
        {reorderPoint !== null && <span className="absolute -top-1 h-4 w-0.5 -translate-x-1/2 rounded bg-amber-500/80" style={{ left: pct(reorderPoint) }} title={`Reorder point: ${reorderPoint}`} />}
      </div>
      {!compact && (
        <div className="mt-1.5 flex justify-between text-[11px] text-gray-500 dark:text-gray-400">
          <span className="tabular-nums">{stock} on hand</span>
          <span className="tabular-nums">{reorderPoint === null ? 'No reorder point' : `ROP ${reorderPoint}`}</span>
        </div>
      )}
    </div>
  );
}

export function StatusBadge({ status }: { status: 'critical' | 'reorder' | 'healthy' }) {
  if (status === 'critical') return <Badge tone="red" dot>Critical</Badge>;
  if (status === 'reorder') return <Badge tone="amber" dot>Reorder</Badge>;
  return <Badge tone="green" dot>Healthy</Badge>;
}

/* ---------------- Gauge ---------------- */

/** A 270° score gauge. Pass null when there isn't enough input for a score; it shows "—" instead of a number. */
export function Gauge({ value: raw, size = 96, label, stroke = 9 }: { value: number | null; size?: number; label?: string; stroke?: number }) {
  const value = raw ?? 0;
  const [shown, setShown] = useState(0);
  const mounted = useRef(false);
  useEffect(() => {
    const t = setTimeout(() => setShown(value), mounted.current ? 0 : 60);
    mounted.current = true;
    return () => clearTimeout(t);
  }, [value]);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const arc = 0.75; // 270° gauge
  const color = value >= 80 ? 'stroke-brand-600 dark:stroke-brand-400' : value >= 65 ? 'stroke-amber-400' : 'stroke-red-500';
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[135deg]">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" className="stroke-gray-100 dark:stroke-white/[0.07]" strokeDasharray={`${c * arc} ${c}`} />
        {raw !== null && <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className={clsx(color, 'transition-[stroke-dasharray] duration-1000 ease-out')}
          strokeDasharray={`${(c * arc * shown) / 100} ${c}`}
        />}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {raw === null ? <span className="text-xl font-bold text-gray-400">—</span> : <AnimatedNumber value={value} format={(n) => Math.round(n).toString()} className="text-xl font-bold" />}
        {label && <span className="-mt-0.5 text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</span>}
      </div>
    </div>
  );
}

/* ---------------- Progress ring ---------------- */

export function Ring({ value, size = 44, stroke = 5 }: { value: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-gray-100 dark:stroke-white/[0.07]" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" className="stroke-brand-600 transition-all duration-700 dark:stroke-brand-400" strokeDasharray={`${(c * value) / 100} ${c}`} />
      </svg>
      <span className="absolute text-[11px] font-semibold tabular-nums">{Math.round(value)}</span>
    </div>
  );
}

/* ---------------- Field ---------------- */

export function Field({ label, error, hint, children, className }: { label: string; error?: string | null; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={clsx('block', className)}>
      <span className="label">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-red-600 dark:text-red-400">{error}</span> : hint ? <span className="muted mt-1 block text-xs">{hint}</span> : null}
    </label>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
  return <span className={clsx('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300', className)}>{initials}</span>;
}
