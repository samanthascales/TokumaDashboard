import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { Check, Copy, ExternalLink, Landmark, Leaf, Printer, ShieldCheck } from 'lucide-react';
import { useStore } from '../store/AppStore';
import { lastNDays } from '../lib/metrics';
import { cashRunway, profitAndLoss } from '../lib/accounting';
import { linkTooLong, reportLink, type ReportKind, type SharedReport } from '../lib/share';
import { startOfToday, toISO } from '../lib/format';
import { useT } from '../i18n';
import { Card, Field, PageHeader, Toggle } from '../components/ui';
import { ReportView } from '../components/ReportView';
import { IS_EMBEDDED } from '../env';

type Section = 'financial' | 'balance' | 'readiness' | 'circularity' | 'products';

/** Pick what to share, preview it, and get a read-only link or a PDF. */
export default function Share() {
  const t = useT();
  const s = useStore();
  const [params, setParams] = useSearchParams();
  const kind: ReportKind = params.get('type') === 'impact' ? 'impact' : 'lender';
  const setKind = (k: ReportKind) => setParams({ type: k }, { replace: true });
  const [sections, setSections] = useState<Record<Section, boolean>>({ financial: true, balance: true, readiness: true, circularity: true, products: true });
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => setCopied(false), [kind, sections, note]);

  const report = useMemo<SharedReport>(() => {
    const on = (k: Section) => sections[k];
    const p = s.profile;
    const yr = profitAndLoss(s.transactions, lastNDays(365));
    const from30 = toISO(lastNDays(30).from);
    const lender = kind === 'lender';
    return {
      v: 1,
      kind,
      created: toISO(startOfToday()),
      business: { name: p.businessName, industry: p.industry, country: p.country, description: p.description },
      note: note.trim(),
      ...(lender && on('financial') ? { financial: { revenue: s.pnl30.incomeTotal, expenses: s.pnl30.expenseTotal, profit: s.pnl30.profit, revenue12m: yr.incomeTotal, profit12m: yr.profit } } : {}),
      ...(lender && on('balance')
        ? { balance: { cash: s.balance.cash, assets: s.balance.assetsTotal, liabilities: s.balance.liabilitiesTotal, equity: s.balance.equity, runwayMonths: cashRunway(s.transactions, s.balance.cash)?.months ?? null } }
        : {}),
      ...(lender && on('readiness') ? { readiness: { score: s.readiness.score, level: s.readiness.level } } : {}),
      ...(!lender || on('circularity')
        ? {
            circularity: {
              score: s.score.score,
              level: s.score.level,
              range: s.score.range,
              pillars: s.score.pillars.map((x) => ({ key: x.key, value: x.value, raw: x.raw })),
              circularKg: s.circ30.circularKg,
              wasteKg: s.wasteLog.filter((w) => w.date >= from30).reduce((sum, w) => sum + w.kg, 0),
              products: on('products') ? [...s.products].sort((a, b) => b.circularityScore - a.circularityScore).slice(0, 12).map((x) => ({ name: x.name, score: x.circularityScore })) : [],
            },
          }
        : {}),
    };
  }, [kind, sections, note, s.profile, s.transactions, s.pnl30, s.balance, s.readiness, s.score, s.circ30, s.wasteLog, s.products]);

  const link = reportLink(report);
  const tooLong = linkTooLong(report);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      window.prompt(t('Copy this link'), link);
    }
  };

  const options: { key: Section; label: string; hint: string; lenderOnly?: boolean }[] = [
    { key: 'financial', label: t('Financial summary'), hint: t('Revenue, expenses and net profit'), lenderOnly: true },
    { key: 'balance', label: t('Balance sheet'), hint: t('Assets, liabilities, owner’s equity and cash runway'), lenderOnly: true },
    { key: 'readiness', label: t('Funding readiness'), hint: t('How complete your records are'), lenderOnly: true },
    { key: 'circularity', label: t('Circularity score'), hint: t('Your score and its five pillars'), lenderOnly: true },
    { key: 'products', label: t('Products'), hint: t('Each product’s circularity score') },
  ];

  return (
    <>
      <PageHeader title={t('Share a report')} sub={t('Create a read-only snapshot for a lender, investor or mentor, or a circularity report for your customers.')} />
      <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <div className="space-y-5">
          <Card className="p-5">
            <p className="label">{t('Who is it for?')}</p>
            <div className="grid gap-2" role="radiogroup">
              {(
                [
                  { k: 'lender', icon: Landmark, title: t('Lender & investor report'), body: t('Financial summary, balance sheet, funding readiness and circularity.') },
                  { k: 'impact', icon: Leaf, title: t('Circularity impact report'), body: t('Your circularity score and impact for customers. No financial figures.') },
                ] as const
              ).map((o) => (
                <button
                  key={o.k}
                  role="radio"
                  aria-checked={kind === o.k}
                  onClick={() => setKind(o.k)}
                  className={clsx('flex gap-3 rounded-xl border p-3 text-start transition', kind === o.k ? 'border-brand-400 bg-brand-50 dark:border-brand-500/50 dark:bg-brand-500/10' : 'border-gray-200 hover:border-gray-300 dark:border-white/10')}
                >
                  <o.icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-700 dark:text-brand-300" />
                  <span>
                    <span className="block text-sm font-semibold">{o.title}</span>
                    <span className="muted block text-xs">{o.body}</span>
                  </span>
                </button>
              ))}
            </div>

            <p className="label mt-5">{t('What to include')}</p>
            <ul className="space-y-2.5">
              {options
                .filter((o) => kind === 'lender' || !o.lenderOnly)
                .map((o) => (
                  <li key={o.key} className="flex items-center justify-between gap-3">
                    <span>
                      <span className="block text-sm font-medium">{o.label}</span>
                      <span className="muted block text-xs">{o.hint}</span>
                    </span>
                    <Toggle checked={sections[o.key] && (o.key !== 'products' || kind === 'impact' || sections.circularity)} onChange={(v) => setSections((x) => ({ ...x, [o.key]: v }))} label={o.label} />
                  </li>
                ))}
            </ul>

            <Field label={t('Message (optional)')} className="mt-5" hint={t('Shown at the top of the report.')}>
              <textarea rows={3} maxLength={600} className="input resize-none" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('Hi, here is a snapshot of my business…')} />
            </Field>
          </Card>

          <Card className="p-5">
            <div className="flex flex-col gap-2">
              <button className="btn-primary" onClick={copy} disabled={tooLong} data-testid="copy-link">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? t('Link copied') : t('Copy link')}
              </button>
              <a className={clsx('btn-secondary', tooLong && 'pointer-events-none opacity-50')} href={link} target="_blank" rel="noreferrer" data-testid="open-link">
                <ExternalLink className="h-4 w-4" /> {t('Open the report')}
              </a>
              {!IS_EMBEDDED && (
                <button className="btn-secondary" onClick={() => window.print()}>
                  <Printer className="h-4 w-4" /> {t('Print or save as PDF')}
                </button>
              )}
            </div>
            {tooLong && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{t('This report is too long for a link. Turn off the product list or shorten your message.')}</p>}
            <p className="mt-4 flex gap-2 rounded-lg bg-gray-50 p-3 text-xs leading-relaxed dark:bg-white/[0.03]">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
              <span>{t('The report lives entirely inside the link: Tokuma does not store it or show it to anyone. Anyone with the link can read it, so only share it with people you trust. It is a snapshot and will not update.')}</span>
            </p>
          </Card>
        </div>

        <Card className="print-area p-6 sm:p-8">
          <p className="muted no-print mb-4 text-xs font-medium uppercase tracking-wider">{t('Preview')}</p>
          <ReportView report={report} />
        </Card>
      </div>
    </>
  );
}
