import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { BadgeCheck, Coins, FileClock, Gift, HandCoins, Landmark, PieChart, Sparkles, TrendingDown } from 'lucide-react';
import { useStore } from '../store/AppStore';
import { useSimulatedLoad } from '../lib/hooks';
import { fmtDate, fmtMoney, fmtPct } from '../lib/format';
import { tk, useT } from '../i18n';
import { avgKnown, fundingTerms, lastNDays, totalsFor } from '../lib/metrics';
import { AnimatedNumber, Badge, Card, CardHeader, CardSkeleton, EmptyState, Field, Modal, PageHeader } from '../components/ui';
import type { FundingStatus, FundingType } from '../types';

const TYPES: { type: FundingType; icon: typeof Coins; desc: string; range: string }[] = [
  { type: 'Loan', icon: Landmark, desc: tk('Green working-capital loan priced on your circularity data.'), range: tk('Up to your max eligibility') },
  { type: 'Grant', icon: Gift, desc: tk('Non-dilutive circular economy grants matched to your profile.'), range: '$5k – $50k' },
  { type: 'Equity', icon: PieChart, desc: tk('Impact investors in the Tokuma network looking for circular businesses.'), range: '$25k – $500k' },
  { type: 'Reward', icon: HandCoins, desc: tk('Community pre-order campaigns backed by your verified impact.'), range: '$2k – $25k' },
];
const requestLabel: Record<FundingType, string> = { Loan: tk('Request loan'), Grant: tk('Request grant'), Equity: tk('Request equity'), Reward: tk('Request reward') };

const statusTone: Record<FundingStatus, 'amber' | 'blue' | 'green' | 'red'> = { Pending: 'amber', Approved: 'blue', Funded: 'green', Declined: 'red' };

export default function Funding() {
  const t = useT();
  const { verification, funding, circ30, fundingSeen, markFundingSeen, flashFunding, fundingRequests, requestFunding, suppliers, ledger, role } = useStore();
  const ready = useSimulatedLoad('funding');
  const [req, setReq] = useState<FundingType | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [purpose, setPurpose] = useState('');
  const [touched, setTouched] = useState(false);
  const [sim, setSim] = useState(circ30.hasData ? Math.round(circ30.rate) : 50);
  const [flash, setFlash] = useState(false);
  const seenRef = useRef(fundingSeen);

  // Highlight numbers when they've moved since the last visit or while on the page.
  useEffect(() => {
    const prev = seenRef.current;
    if (prev && prev.apr !== null && funding.apr !== null && (Math.abs(prev.apr - funding.apr) > 0.001 || prev.maxEligibility !== funding.maxEligibility)) setFlash(true);
    const timer = setTimeout(markFundingSeen, 2500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const flashAtMount = useRef(flashFunding);
  useEffect(() => {
    if (flashFunding !== flashAtMount.current) setFlash(true);
  }, [flashFunding]);
  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(false), 1700);
    return () => clearTimeout(timer);
  }, [flash]);

  const simTerms = useMemo(() => {
    const yr = totalsFor(ledger, lastNDays(365));
    const avgSust = avgKnown(suppliers.map((x) => x.sustainabilityRating));
    return fundingTerms(sim, yr.revenue, avgSust, yr.revenue ? yr.profit / yr.revenue : 0);
  }, [sim, ledger, suppliers]);

  const prev = seenRef.current;
  const changed = prev && circ30.hasData && prev.apr !== null && funding.apr !== null && Math.abs(prev.rate - circ30.rate) > 0.05;
  const pending = fundingRequests.filter((r) => r.status === 'Pending').length;
  const funded = fundingRequests.filter((r) => r.status === 'Funded').reduce((s, r) => s + r.amount, 0);
  const overMax = req === 'Loan' && amount !== null && funding.maxEligibility !== null && amount > funding.maxEligibility;
  const amountErr = amount === null || amount <= 0 ? t('Enter an amount') : overMax ? t('Max loan eligibility is {amount}', { amount: fmtMoney(funding.maxEligibility!) }) : null;
  const purposeErr = purpose.trim().length < 5 ? t('Describe what the funds are for') : null;

  if (!ready)
    return (
      <>
        <PageHeader title={t('Funding')} sub={t('Your circular data, turned into access to capital')} />
        <div className="grid grid-cols-12 gap-5">
          <CardSkeleton className="col-span-12 h-[120px]" lines={2} />
          <CardSkeleton className="col-span-12 h-[180px] md:col-span-6" lines={3} />
          <CardSkeleton className="col-span-12 h-[180px] md:col-span-6" lines={3} />
          <CardSkeleton className="col-span-12 h-[300px]" lines={6} />
        </div>
      </>
    );

  return (
    <>
      <PageHeader title={t('Funding')} sub={t('Your circular data, turned into access to capital')} />

      <div className="relative mb-5 overflow-hidden rounded-xl bg-gradient-to-br from-brand-700 to-brand-900 p-6 text-white shadow-lift">
        <div className="absolute -end-10 -top-10 h-48 w-48 rounded-full bg-white/5" />
        <div className="absolute -bottom-16 end-24 h-40 w-40 rounded-full bg-white/5" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
            <BadgeCheck className="h-6 w-6" />
          </div>
          <div className="flex-1">
            {verification.verified ? (
              <>
                <p className="text-lg font-semibold">{t('Verified Circular Business')}</p>
                <p className="text-sm text-brand-100/80">{t('Your transactions, materials and supplier data are verified. Lenders see a live circularity score of {pct}.', { pct: fmtPct(circ30.rate) })}</p>
              </>
            ) : (
              <>
                <p className="text-lg font-semibold">{t('Get verified to unlock funding')}</p>
                <ul className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-sm text-brand-100/90">
                  {verification.steps.map((s) => (
                    <li key={s.label} className="flex items-center gap-1.5">
                      <span className={clsx('flex h-4 w-4 items-center justify-center rounded-full text-[10px]', s.done ? 'bg-white text-brand-800' : 'ring-1 ring-white/40')}>{s.done ? '✓' : ''}</span>
                      {s.label}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <div className="text-end">
            <p className="text-xs uppercase tracking-wider text-brand-200">{t('Funding score')}</p>
            {funding.score === null ? <p className="text-3xl font-bold text-white/50">—</p> : <AnimatedNumber value={funding.score} format={(n) => `${Math.round(n)}/100`} className="text-3xl font-bold" />}
          </div>
        </div>
      </div>

      {changed && (
        <div className="mb-5 flex animate-page-in items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800 dark:border-brand-500/20 dark:bg-brand-500/[0.07] dark:text-brand-200">
          <Sparkles className="h-4 w-4 shrink-0" />
          {prev!.maxEligibility !== null && funding.maxEligibility !== null
            ? t('Since your last visit circularity moved {from} → {to}, so your estimated APR went {aprFrom} → {aprTo} and eligibility {eligFrom} → {eligTo}.', {
                from: fmtPct(prev!.rate),
                to: fmtPct(circ30.rate),
                aprFrom: fmtPct(prev!.apr!, 2),
                aprTo: fmtPct(funding.apr!, 2),
                eligFrom: fmtMoney(prev!.maxEligibility),
                eligTo: fmtMoney(funding.maxEligibility),
              })
            : t('Since your last visit circularity moved {from} → {to}, so your estimated APR went {aprFrom} → {aprTo}.', {
                from: fmtPct(prev!.rate),
                to: fmtPct(circ30.rate),
                aprFrom: fmtPct(prev!.apr!, 2),
                aprTo: fmtPct(funding.apr!, 2),
              })}
        </div>
      )}

      <div className="grid grid-cols-12 gap-5">
        <Card className={clsx('col-span-12 p-6 md:col-span-4', flash && 'animate-flash')}>
          <p className="muted flex items-center gap-1.5 text-xs">
            <Coins className="h-3.5 w-3.5" /> {t('Max eligibility')}
          </p>
          {funding.maxEligibility === null ? (
            <p className="mt-2 text-4xl font-bold tracking-tight text-gray-300 dark:text-gray-600">—</p>
          ) : (
            <AnimatedNumber value={funding.maxEligibility} format={fmtMoney} duration={1200} className="mt-2 block text-4xl font-bold tracking-tight" />
          )}
          <p className="muted mt-2 text-xs">
            {funding.maxEligibility !== null
              ? t('≈ {pct} of your last 12 months of revenue ({revenue})', { pct: fmtPct((funding.maxEligibility / funding.annualRevenue) * 100, 0), revenue: fmtMoney(funding.annualRevenue) })
              : t('Log sales of products with materials to calculate this')}
          </p>
        </Card>
        <Card className={clsx('col-span-12 p-6 md:col-span-4', flash && 'animate-flash')}>
          <p className="muted flex items-center gap-1.5 text-xs">
            <TrendingDown className="h-3.5 w-3.5" /> {t('Estimated APR')}
          </p>
          {funding.apr === null ? (
            <p className="mt-2 text-4xl font-bold tracking-tight text-gray-300 dark:text-gray-600">—</p>
          ) : (
            <AnimatedNumber value={funding.apr} format={(n) => fmtPct(n, 2)} duration={1200} className="mt-2 block text-4xl font-bold tracking-tight text-brand-700 dark:text-brand-400" />
          )}
          <p className="muted mt-2 text-xs">{funding.apr !== null ? t('Estimated from your circularity rate and supplier ratings') : t('Log sales of products with materials to calculate this')}</p>
        </Card>
        <Card className="col-span-12 p-6 md:col-span-4">
          <p className="muted flex items-center gap-1.5 text-xs">
            <Sparkles className="h-3.5 w-3.5" /> {t('What if circularity were…')}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-4xl font-bold tabular-nums">{fmtPct(sim, 0)}</span>
            <span className="muted text-xs">({t('now {pct}', { pct: circ30.hasData ? fmtPct(circ30.rate, 0) : '—' })})</span>
          </div>
          <input type="range" min={0} max={100} value={sim} onChange={(e) => setSim(+e.target.value)} className="mt-3 w-full accent-brand-600" aria-label={t('Simulated circularity rate')} />
          {simTerms.ready ? (
            <div className="mt-2 flex justify-between text-xs">
              <span>
                {t('APR')} <b className="tabular-nums">{fmtPct(simTerms.apr!, 2)}</b>
              </span>
              <span>
                {t('Eligibility')} <b className="tabular-nums">{fmtMoney(simTerms.maxEligibility!)}</b>
              </span>
            </div>
          ) : (
            <p className="muted mt-2 text-xs">{t('Needs your logged revenue to project terms.')}</p>
          )}
        </Card>

        <div className="col-span-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {TYPES.map((x) => (
            <Card key={x.type} hover className="flex flex-col p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                <x.icon className="h-5 w-5" />
              </span>
              <p className="mt-3 font-semibold">{t(x.type)}</p>
              <p className="muted mt-1 flex-1 text-sm">{t(x.desc)}</p>
              <p className="mt-3 text-xs font-medium text-gray-500">
                {x.type === 'Loan'
                  ? funding.ready
                    ? t('Up to {amount} at ~{apr} (estimate)', { amount: fmtMoney(funding.maxEligibility!), apr: fmtPct(funding.apr!, 2) })
                    : t('Estimate available once you log sales')
                  : t(x.range)}
              </p>
              {role === 'business' && (
                <button
                  className="btn-secondary btn-sm mt-3"
                  onClick={() => {
                    setReq(x.type);
                    setAmount(null);
                    setPurpose('');
                    setTouched(false);
                  }}
                >
                  {t(requestLabel[x.type])}
                </button>
              )}
            </Card>
          ))}
        </div>

        <Card className="col-span-12 overflow-hidden">
          <CardHeader title={t('Request history')} sub={t('{pending} pending · {amount} funded to date', { pending, amount: fmtMoney(funded) })} />
          {fundingRequests.length === 0 ? (
            <EmptyState icon={<FileClock className="h-6 w-6" />} title={t('No funding requests yet')} body={t('Request a loan, grant, equity or reward campaign — your verified data is attached automatically.')} />
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50/60 dark:bg-white/[0.02]">
                  <tr>
                    <th className="th">{t('Submitted')}</th>
                    <th className="th">{t('Type')}</th>
                    <th className="th">{t('Purpose')}</th>
                    <th className="th text-end">{t('Amount')}</th>
                    <th className="th text-end">{t('APR')}</th>
                    <th className="th">{t('Status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {fundingRequests.map((r) => (
                    <tr key={r.id} className="tr">
                      <td className="td text-gray-500">{fmtDate(r.submittedDate)}</td>
                      <td className="td font-medium">{t(r.type)}</td>
                      <td className="td">{r.purpose}</td>
                      <td className="td text-end font-semibold tabular-nums">{fmtMoney(r.amount)}</td>
                      <td className="td text-end tabular-nums">{r.apr ? fmtPct(r.apr, 2) : '—'}</td>
                      <td className="td">
                        <Badge tone={statusTone[r.status]} dot>
                          {t(r.status)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Modal
        open={!!req}
        onClose={() => setReq(null)}
        title={req ? t(requestLabel[req]) : ''}
        sub={t('Your circularity report, transactions and supplier data are attached automatically')}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setReq(null)}>
              {t('Cancel')}
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                setTouched(true);
                if (amountErr || purposeErr || !req) return;
                requestFunding({ type: req, amount: amount!, purpose: purpose.trim() });
                setReq(null);
              }}
            >
              {t('Submit request')}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={t('Amount ($)')} error={touched || overMax ? amountErr : null}>
            <input type="number" min={0} step={500} className={clsx('input', (touched || overMax) && amountErr && 'input-error')} placeholder={t('How much are you asking for?')} value={amount ?? ''} onChange={(e) => setAmount(e.target.value.trim() === '' ? null : Number(e.target.value))} />
          </Field>
          <Field label={t('Purpose')} error={touched ? purposeErr : null}>
            <textarea rows={3} className={clsx('input resize-none', touched && purposeErr && 'input-error')} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder={t('e.g. Expand recycled-fibre inventory ahead of holiday season')} />
          </Field>
          {req === 'Loan' && funding.apr !== null && amount !== null && amount > 0 && (
            <div className="rounded-lg bg-gray-50 p-3 text-sm dark:bg-white/[0.03]">
              <div className="flex justify-between">
                <span className="muted">{t('Estimated APR')}</span>
                <span className="font-semibold">{fmtPct(funding.apr, 2)}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="muted">{t('Est. monthly payment (24 mo)')}</span>
                <span className="font-semibold tabular-nums">
                  {fmtMoney((() => {
                    const r = funding.apr / 100 / 12;
                    return (amount * r) / (1 - Math.pow(1 + r, -24));
                  })())}
                </span>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
