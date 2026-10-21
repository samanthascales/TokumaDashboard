import clsx from 'clsx';
import { Lock, Quote } from 'lucide-react';
import { fmtDate, fmtKg, fmtMoney, fmtNum, fmtPct } from '../lib/format';
import { GLOBAL_CIRCULARITY_PCT, LEVEL_FROM } from '../lib/score';
import type { SharedReport } from '../lib/share';
import { useT } from '../i18n';
import { Badge, Gauge, Term } from './ui';
import { Logo } from './layout/Sidebar';
import { levelName, levelTone, ScoreExplainer } from './ScoreBits';
import { PILLAR_COPY, rawText } from '../pages/circularity/ScorePanels';
import { readinessLevelName, readinessTone } from '../pages/funding/ReadinessCard';

function Section({ title, children, testId }: { title: React.ReactNode; children: React.ReactNode; testId?: string }) {
  return (
    <section className="break-inside-avoid border-t border-gray-200 pt-5 dark:border-white/10" data-testid={testId}>
      <h2 className="mb-3 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value, explain, tone }: { label: string; value: string; explain?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="rounded-xl bg-gray-50 p-3 dark:bg-white/[0.03]">
      <p className="muted text-xs">{explain ? <Term label={label}>{explain}</Term> : label}</p>
      <p className={clsx('num mt-0.5 text-lg', tone === 'good' && 'text-brand-700 dark:text-brand-400', tone === 'bad' && 'text-red-600 dark:text-red-400')}>{value}</p>
    </div>
  );
}

/** A shared report, as the reader sees it. Used for the owner's preview and the public link. */
export function ReportView({ report: r }: { report: SharedReport }) {
  const t = useT();
  const c = r.circularity;
  const inflow = c?.pillars.find((p) => p.key === 'inflow');
  const outflow = c?.pillars.find((p) => p.key === 'outflow');
  const margin = r.financial && r.financial.revenue > 0 ? (r.financial.profit / r.financial.revenue) * 100 : null;
  return (
    <article className="space-y-5 text-sm" data-testid="report-view">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Logo />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">{r.kind === 'lender' ? t('Lender & investor report') : t('Circularity impact report')}</h1>
          <p className="mt-1 text-base font-medium">{r.business.name || t('Your business')}</p>
          <p className="muted">{[r.business.industry, r.business.country].filter(Boolean).join(' · ')}</p>
          {r.business.description && <p className="mt-2 max-w-2xl leading-relaxed">{r.business.description}</p>}
        </div>
        <div className="muted flex items-center gap-1.5 text-xs">
          <Lock className="h-3.5 w-3.5" />
          {r.created ? t('Read-only snapshot from {date}', { date: fmtDate(r.created) }) : t('Read-only snapshot')}
        </div>
      </header>

      {r.note && (
        <blockquote className="flex gap-3 rounded-xl border border-gray-200 p-4 dark:border-white/10">
          <Quote className="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
          <p className="whitespace-pre-line leading-relaxed">{r.note}</p>
        </blockquote>
      )}

      {r.kind === 'impact' && c && (
        <div className="grid gap-3 sm:grid-cols-3" data-testid="impact-highlights">
          <Stat label={t('Circularity score')} value={c.score === null ? '—' : `${c.score} / 100`} />
          <Stat label={t('Circular materials')} value={inflow?.raw != null ? fmtPct(inflow.raw, 0) : '—'} explain={t('Share of the materials in what was sold that were recycled, reused or certified renewable. The world average is {pct}.', { pct: fmtPct(GLOBAL_CIRCULARITY_PCT) })} />
          <Stat label={t('Waste kept out of landfill')} value={outflow?.raw != null ? fmtPct(outflow.raw, 0) : '—'} />
        </div>
      )}

      {r.financial && (
        <Section title={t('Financial summary (last 30 days)')} testId="report-financial">
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label={t('Revenue')} value={fmtMoney(r.financial.revenue)} />
            <Stat label={t('Expenses')} value={fmtMoney(r.financial.expenses)} />
            <Stat label={r.financial.profit >= 0 ? t('Net profit') : t('Net loss')} value={fmtMoney(r.financial.profit)} tone={r.financial.profit >= 0 ? 'good' : 'bad'} />
            <Stat label={t('Profit margin')} value={margin === null ? '—' : fmtPct(margin, 0)} />
          </div>
          <p className="muted mt-3">{t('Last 12 months: revenue {revenue}, net profit {profit}.', { revenue: fmtMoney(r.financial.revenue12m), profit: fmtMoney(r.financial.profit12m) })}</p>
        </Section>
      )}

      {r.balance && (
        <Section title={t('Balance sheet')} testId="report-balance">
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label={t('Total assets')} value={fmtMoney(r.balance.assets)} />
            <Stat label={t('Total liabilities')} value={fmtMoney(r.balance.liabilities)} />
            <Stat label={t('Owner’s equity')} value={fmtMoney(r.balance.equity)} tone={r.balance.equity >= 0 ? 'good' : 'bad'} />
            <Stat label={t('Cash runway')} value={r.balance.runwayMonths === null ? '—' : t('{n} months', { n: fmtNum(r.balance.runwayMonths) })} />
          </div>
          <p className="muted mt-3">{t('Cash balance: {amount}.', { amount: fmtMoney(r.balance.cash) })}</p>
        </Section>
      )}

      {r.readiness && (
        <Section title={t('Funding readiness')} testId="report-readiness">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-2xl font-bold tabular-nums">{r.readiness.score}</p>
            <p className="muted">{t('of 100')}</p>
            <Badge tone={readinessTone(r.readiness.level)} dot>
              {t(readinessLevelName(r.readiness.level))}
            </Badge>
          </div>
          <div className="mt-2 h-2.5 max-w-md overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
            <div className="h-full rounded-full bg-brand-600 dark:bg-brand-400" style={{ width: `${r.readiness.score}%` }} />
          </div>
          <p className="muted mt-2">{t('How complete the business’s records are. It is not a credit score.')}</p>
        </Section>
      )}

      {c && (
        <Section
          title={
            <Term label={t('Circularity score')}>
              <ScoreExplainer />
            </Term>
          }
          testId="report-circularity"
        >
          <div className="grid gap-6 md:grid-cols-[auto_1fr]">
            <div className="flex flex-col items-center text-center">
              <Gauge value={c.score} size={120} stroke={10} label={t('of 100')} bands={[LEVEL_FROM.grower, LEVEL_FROM.leader]} />
              {c.level && (
                <Badge tone={levelTone(c.level)} dot className="mt-2">
                  {levelName(c.level)}
                </Badge>
              )}
              {c.range && c.range[0] !== c.range[1] && <p className="muted mt-1.5 text-xs">{t('Between {a} and {b} depending on the method', { a: c.range[0], b: c.range[1] })}</p>}
            </div>
            <ul className="space-y-3">
              {c.pillars.map((p) => {
                const raw = rawText(t, { ...p, weight: 0.2 });
                return (
                  <li key={p.key}>
                    <div className="flex items-center justify-between gap-2">
                      <Term label={t(PILLAR_COPY[p.key].label)}>{t(PILLAR_COPY[p.key].explain)}</Term>
                      <span className={clsx('font-semibold tabular-nums', p.value === null && 'font-normal text-gray-400')}>{p.value === null ? t('not measured yet') : Math.round(p.value * 100)}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
                      {p.value !== null && <div className="h-full rounded-full bg-brand-600 dark:bg-brand-400" style={{ width: `${p.value * 100}%` }} />}
                    </div>
                    {raw && <p className="muted mt-0.5 text-xs">{raw}</p>}
                  </li>
                );
              })}
            </ul>
          </div>
          <p className="muted mt-3">
            {t('Last 30 days: {kg} of circular material in products sold; {waste} of waste and returned products recorded.', { kg: fmtKg(c.circularKg), waste: fmtKg(c.wasteKg) })}
          </p>
          {c.products.length > 0 && (
            <table className="mt-4 w-full">
              <thead>
                <tr>
                  <th className="th ps-0">{t('Product')}</th>
                  <th className="th text-end">{t('Circularity score')}</th>
                </tr>
              </thead>
              <tbody>
                {c.products.map((p) => (
                  <tr key={p.name} className="tr">
                    <td className="td ps-0">{p.name}</td>
                    <td className="td text-end font-semibold tabular-nums">{p.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      )}

      <footer className="muted border-t border-gray-200 pt-4 text-xs leading-relaxed dark:border-white/10">
        {t('Figures come from the business’s own records in Tokuma and have not been audited. The circularity score follows published research (ISO 59020, Ellen MacArthur Foundation, WBCSD); some details are still being confirmed.')}
      </footer>
    </article>
  );
}
