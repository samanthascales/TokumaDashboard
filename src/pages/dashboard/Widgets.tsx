import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { AlertTriangle, Check, Lightbulb, Sparkles, Upload, X, Zap } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { tk, useT } from '../../i18n';
import { Badge, Card, CardHeader, EmptyState, Segmented } from '../../components/ui';
import type { InsightKind } from '../../types';

/* ---------------- Low stock banner ---------------- */

export function LowStockBanner() {
  const t = useT();
  const { inventory } = useStore();
  const navigate = useNavigate();
  const [hidden, setHidden] = useState(false);
  const critical = inventory.filter((r) => r.status === 'critical');
  const reorder = inventory.filter((r) => r.status === 'reorder');
  if (hidden || (!critical.length && !reorder.length)) return null;
  const isRed = critical.length > 0;
  const items = [...critical, ...reorder];
  return (
    <div
      className={clsx(
        'mb-6 flex animate-page-in flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center',
        isRed ? 'border-red-200 bg-red-50 dark:border-red-500/20 dark:bg-red-500/[0.07]' : 'border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/[0.07]',
      )}
      role="alert"
    >
      <div className={clsx('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', isRed ? 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400')}>
        <AlertTriangle className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className={clsx('text-sm font-semibold', isRed ? 'text-red-800 dark:text-red-200' : 'text-amber-800 dark:text-amber-200')}>
          {critical.length > 0 && t('{count} products below low-stock threshold', { count: critical.length })}
          {critical.length > 0 && reorder.length > 0 && ' · '}
          {reorder.length > 0 && t('{count} at reorder point', { count: reorder.length })}
        </p>
        <p className={clsx('truncate text-xs', isRed ? 'text-red-700/80 dark:text-red-300/80' : 'text-amber-700/80 dark:text-amber-300/80')}>
          {items
            .map((r) => `${r.product.name} (${Number.isFinite(r.daysOfCover) ? t('{n} left, ~{d}d cover', { n: r.product.stockOnHand, d: Math.floor(r.daysOfCover) }) : t('{n} left', { n: r.product.stockOnHand })})`)
            .join(' · ')}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button className={clsx('btn btn-sm text-white', isRed ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700')} onClick={() => navigate('/app/products/inventory')}>
          {t('View inventory')}
        </button>
        <button className="icon-btn h-8 w-8" onClick={() => setHidden(true)} aria-label={t('Dismiss')}>
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

const kindMeta: Record<InsightKind, { icon: typeof Zap; label: string; cls: string }> = {
  optimization: { icon: Zap, label: tk('Optimization'), cls: 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300' },
  alert: { icon: AlertTriangle, label: tk('Alert'), cls: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' },
  opportunity: { icon: Lightbulb, label: tk('Opportunity'), cls: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300' },
};

export function InsightsFeed({ title }: { title?: string } = {}) {
  const t = useT();
  const { insights, dismissInsight, applyMaterialSwitch, restoreInsights, dismissedInsights } = useStore();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | InsightKind>('all');
  const shown = insights.filter((i) => filter === 'all' || i.kind === filter);
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-600 dark:text-brand-400" /> {title ?? t('Circular insights')}
          </span>
        }
        sub={t('{count} active · generated from your data', { count: insights.length })}
      />
      <div className="px-5 pt-3">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: t('All') },
            { value: 'alert', label: t('Alerts') },
            { value: 'optimization', label: t('Optimize') },
            { value: 'opportunity', label: t('Opportunities') },
          ]}
        />
      </div>
      <div className="scrollbar-thin mt-3 max-h-[520px] flex-1 space-y-2.5 overflow-y-auto px-5 pb-5">
        {shown.length === 0 && (
          <EmptyState
            icon={<Check className="h-6 w-6" />}
            title={t('No insights right now')}
            body={t('Insights appear as you add products, suppliers and sales, and update as your data changes.')}
            action={dismissedInsights.length > 0 && <button className="btn-secondary btn-sm" onClick={restoreInsights}>{t('Restore dismissed ({count})', { count: dismissedInsights.length })}</button>}
          />
        )}
        {shown.map((i) => {
          const meta = kindMeta[i.kind];
          const Icon = meta.icon;
          return (
            <div key={i.id} className="group animate-pop-in rounded-xl border border-gray-100 bg-gray-50/50 p-3.5 transition hover:border-gray-200 hover:bg-white hover:shadow-card dark:border-white/5 dark:bg-white/[0.02] dark:hover:bg-white/[0.04]">
              <div className="flex gap-3">
                <span className={clsx('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', meta.cls)}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold leading-snug">{i.title}</p>
                    <button className="-me-1 -mt-0.5 rounded p-0.5 text-gray-300 opacity-0 transition hover:text-gray-600 group-hover:opacity-100 dark:hover:text-gray-200" onClick={() => dismissInsight(i.id)} aria-label={t('Dismiss insight')}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="muted mt-1 text-xs leading-relaxed">{i.body}</p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <Badge tone={i.kind === 'alert' ? 'amber' : i.kind === 'opportunity' ? 'blue' : 'green'}>{i.impact}</Badge>
                    <Badge tone="gray">{t('{level} confidence', { level: t(i.confidence) })}</Badge>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      className="btn-primary btn-sm"
                      onClick={() => {
                        if (i.action.type === 'navigate') navigate(i.action.to);
                        else {
                          applyMaterialSwitch(i.action.productId, i.action.materialName);
                          dismissInsight(i.id);
                        }
                      }}
                    >
                      {i.actionLabel}
                    </button>
                    <button className="btn-ghost btn-sm" onClick={() => dismissInsight(i.id)}>
                      {t('Dismiss')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ---------------- Getting started (new accounts) ---------------- */

export function GettingStarted({ onImportSales }: { onImportSales: () => void }) {
  const t = useT();
  const { profile, products, suppliers, transactions } = useStore();
  const navigate = useNavigate();
  const steps = [
    { label: t('Complete your business profile'), body: t('Name, industry and what you make.'), done: !!profile.businessName.trim(), to: '/onboarding', cta: t('Set up profile') },
    { label: t('Add your first product'), body: t('List its materials so Tokuma can score circularity.'), done: products.length > 0, to: '/app/products?new=product', cta: t('Add product') },
    { label: t('Add a supplier'), body: t('Lead times drive your automatic reorder points.'), done: suppliers.length > 0, to: '/app/products/suppliers?new=supplier', cta: t('Add supplier') },
    { label: t('Log your first sale'), body: t('Sales power revenue, circularity and customer insights. Log one, or import a sales export.'), done: transactions.some((x) => x.type === 'inflow'), to: '/app/money?new=txn', cta: t('Log sale'), sale: true },
  ];
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  const next = steps.findIndex((s) => !s.done);
  return (
    <Card className="mb-6 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
        <div>
          <h3 className="card-title">{t('Get started with Tokuma')}</h3>
          <p className="card-sub mt-0.5">{t('Your dashboard fills in as you add your own data.')}</p>
        </div>
        <span className="text-xs font-semibold tabular-nums text-brand-700 dark:text-brand-400">
          {t('{done} of {total} done', { done, total: steps.length })}
        </span>
      </div>
      <div className="mx-5 mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
        <div className="h-full rounded-full bg-brand-600 transition-all duration-700 dark:bg-brand-400" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((s, i) => (
          <li
            key={s.to}
            className={clsx(
              'flex flex-col rounded-xl border p-4 transition',
              s.done ? 'border-gray-100 bg-gray-50/60 dark:border-white/5 dark:bg-white/[0.02]' : i === next ? 'border-brand-200 bg-brand-50/50 dark:border-brand-500/30 dark:bg-brand-500/[0.06]' : 'border-gray-200 dark:border-white/10',
            )}
          >
            <span className={clsx('flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold', s.done ? 'bg-brand-600 text-white' : 'bg-white text-gray-500 ring-1 ring-gray-200 dark:bg-ink-850 dark:text-gray-300 dark:ring-white/10')}>
              {s.done ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <p className={clsx('mt-3 text-sm font-semibold', s.done && 'text-gray-400 line-through dark:text-gray-500')}>{s.label}</p>
            <p className="muted mt-1 flex-1 text-xs">{s.body}</p>
            {!s.done && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button className={i === next ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} onClick={() => navigate(s.to)}>
                  {s.cta}
                </button>
                {'sale' in s && (
                  <button className="btn-secondary btn-sm" onClick={onImportSales}>
                    <Upload className="h-3.5 w-3.5" /> {t('Import sales')}
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}
