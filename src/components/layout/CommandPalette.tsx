import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { CornerDownLeft, FileText, Moon, Package, Plus, Search, Truck, Upload, User, type LucideIcon } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { allPages, openReport } from './nav';
import { useLang, useT } from '../../i18n';

interface Cmd {
  id: string;
  group: 'Pages' | 'Products' | 'Suppliers' | 'Customers' | 'Actions';
  label: string;
  hint?: string;
  icon: LucideIcon;
  run: () => void;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const { lang } = useLang();
  const { products, suppliers, customers, theme, setThemePref } = useStore();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const commands: Cmd[] = useMemo(() => {
    const go = (to: string) => () => navigate(to);
    return [
      ...allPages.map((p) => ({ id: `page:${p.to}`, group: 'Pages' as const, label: t(p.label), hint: p.to.replace('/app', '') || '/', icon: p.icon, run: go(p.to) })),
      { id: 'act:report', group: 'Actions', label: t('Generate report'), icon: FileText, run: openReport },
      { id: 'act:supplier', group: 'Actions', label: t('Add new supplier'), icon: Plus, run: go('/app/supply-chain?new=supplier') },
      { id: 'act:product', group: 'Actions', label: t('Add new product'), icon: Plus, run: go('/app/products?new=product') },
      { id: 'act:txn', group: 'Actions', label: t('Log a transaction'), icon: Plus, run: go('/app/transactions?new=txn') },
      { id: 'act:import', group: 'Actions', label: t('Import transactions from CSV / Excel'), icon: Upload, run: go('/app/transactions?new=import') },
      { id: 'act:theme', group: 'Actions', label: theme === 'dark' ? t('Switch to light mode') : t('Switch to dark mode'), icon: Moon, run: () => setThemePref(theme === 'dark' ? 'light' : 'dark') },
      ...products.map((p) => ({ id: `prd:${p.id}`, group: 'Products' as const, label: p.name, hint: p.sku, icon: Package, run: go(`/app/products?open=${p.id}`) })),
      ...suppliers.map((s) => ({ id: `sup:${s.id}`, group: 'Suppliers' as const, label: s.name, hint: `${s.city}, ${s.country}`, icon: Truck, run: go(`/app/supply-chain/reliability?open=${s.id}`) })),
      ...customers.map((c) => ({ id: `cus:${c.id}`, group: 'Customers' as const, label: c.name, hint: c.email, icon: User, run: go(`/app/customers?open=${c.id}`) })),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- labels follow the language
  }, [products, suppliers, customers, navigate, theme, setThemePref, lang]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return commands.filter((c) => c.group === 'Pages' || c.group === 'Actions');
    return commands
      .map((c) => {
        const hay = `${c.label} ${c.hint ?? ''}`.toLowerCase();
        const idx = hay.indexOf(s);
        let pos = 0;
        const fuzzy = idx < 0 && [...s].every((ch) => (pos = hay.indexOf(ch, pos) + 1) > 0);
        return { c, score: idx === 0 ? 3 : idx > 0 ? 2 : fuzzy ? 1 : 0 };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 30)
      .map((x) => x.c);
  }, [q, commands]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  const run = (c?: Cmd) => {
    if (!c) return;
    onClose();
    c.run();
  };

  const groups = results.reduce<Record<string, Cmd[]>>((acc, c) => ((acc[c.group] ??= []).push(c), acc), {});
  let i = -1;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh]">
      <div className="absolute inset-0 animate-fade-in bg-gray-950/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-xl animate-pop-in overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-pop dark:border-white/10 dark:bg-ink-850">
        <div className="flex items-center gap-3 border-b border-gray-100 px-4 dark:border-white/5">
          <Search className="h-4 w-4 text-gray-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(results.length - 1, a + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === 'Enter') {
                run(results[active]);
              } else if (e.key === 'Escape') onClose();
            }}
            placeholder={t('Jump to a page, product, supplier or customer…')}
            className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
          />
          <kbd className="rounded border border-gray-200 px-1.5 py-0.5 text-[10px] text-gray-400 dark:border-white/10">ESC</kbd>
        </div>
        <div ref={listRef} className="scrollbar-thin max-h-[55vh] overflow-y-auto p-2">
          {results.length === 0 && <p className="muted px-3 py-10 text-center text-sm">{t('No matches for “{q}”.', { q })}</p>}
          {Object.entries(groups).map(([g, items]) => (
            <div key={g} className="mb-1">
              <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{t(g)}</p>
              {items.map((c) => {
                i++;
                const idx = i;
                const Icon = c.icon;
                return (
                  <button
                    key={c.id}
                    data-idx={idx}
                    onMouseMove={() => setActive(idx)}
                    onClick={() => run(c)}
                    className={clsx('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-start text-sm', idx === active ? 'bg-brand-50 text-brand-800 dark:bg-brand-500/10 dark:text-brand-200' : 'text-gray-700 dark:text-gray-300')}
                  >
                    <Icon className="h-4 w-4 shrink-0 opacity-70" />
                    <span className="flex-1 truncate">{c.label}</span>
                    {c.hint && <span className="truncate text-xs text-gray-400">{c.hint}</span>}
                    {idx === active && <CornerDownLeft className="h-3.5 w-3.5 opacity-60" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 border-t border-gray-100 px-4 py-2 text-[11px] text-gray-400 dark:border-white/5">
          <span>↑↓ {t('navigate')}</span>
          <span>↵ {t('open')}</span>
          <span className="ms-auto">{t('{count} results', { count: results.length })}</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
