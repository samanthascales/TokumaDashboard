import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { BookOpen, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { fmtDate, fmtKg, fmtMoney2, fmtNum, fmtPct, startOfToday, toISO } from '../../lib/format';
import { lastNDays } from '../../lib/metrics';
import { GLOBAL_CIRCULARITY_PCT, LEVEL_FROM, PRODUCTIVITY_RANGE, ROUTE_WEIGHT, ROUTES, SCORE_VERSION, type Pillar, type PillarKey, type ScoreLevel } from '../../lib/score';
import { tk, useT } from '../../i18n';
import { Badge, Card, CardHeader, EmptyState, Field, Gauge, Modal, Term } from '../../components/ui';
import { levelName, levelTone, ScoreExplainer } from '../../components/ScoreBits';
import type { RecoveryRoute } from '../../types';

export const PILLAR_COPY: Record<PillarKey, { label: string; explain: string; source: string; tip: string; missing: string }> = {
  inflow: {
    label: tk('Circular inflow'),
    explain: tk('The share of the weight of everything you sold in the last 30 days made from recycled, reused or sustainably sourced renewable materials.'),
    source: 'WBCSD Circular Transition Indicators · Ellen MacArthur Foundation MCI',
    tip: tk('Switch a new material to a recycled, reused or certified renewable one. See the ideas below.'),
    missing: tk('Sell a product that has its materials filled in.'),
  },
  outflow: {
    label: tk('Circular outflow'),
    explain: tk('Of the waste and returned products you recorded, how much was kept in use. Reuse and repair count most, then refurbishing, then recycling or composting, then energy recovery. Landfill counts nothing.'),
    source: 'WBCSD Circular Transition Indicators · R-ladder (PBL Netherlands)',
    tip: tk('Take products back for repair or resale, and send scraps to reuse or recycling instead of the bin.'),
    missing: tk('Record your production waste and returned products below.'),
  },
  life: {
    label: tk('Product life & use'),
    explain: tk('How long your products last, and how much they are used, compared with typical similar products. A product that lasts twice as long, or gets twice the use because it is shared or rented, gets full marks.'),
    source: 'Ellen MacArthur Foundation MCI (utility factor)',
    tip: tk('Make products last longer, offer repairs and warranties, or rent and share them.'),
    missing: tk('Add how long each product lasts in its product details.'),
  },
  productivity: {
    label: tk('Resource productivity'),
    explain: tk('Revenue for each kilogram of new (virgin) material in what you sell. More revenue from less new material is more circular.'),
    source: 'WBCSD Circular Transition Indicators (circular material productivity)',
    tip: tk('Use less new material per product, or replace it with recycled or reused material.'),
    missing: tk('Sell a product that has its materials filled in.'),
  },
  businessModel: {
    label: tk('Circular business model'),
    explain: tk('The share of your revenue from repairs, resale, rental or sharing, take-back and recycling services.'),
    source: 'MSCI circular economy indexes · WBCSD CTI revenue',
    tip: tk('Offer repairs, resell used items, rent products out, or take old products back.'),
    missing: tk('Record revenue.'),
  },
};

/** The measured number behind a pillar, in words. */
export function rawText(t: (k: string, v?: Record<string, string | number>) => string, p: Pillar) {
  if (p.value === null) return null;
  switch (p.key) {
    case 'inflow':
      return t('{pct} of materials · world average {world}', { pct: fmtPct(p.raw!, 0), world: fmtPct(GLOBAL_CIRCULARITY_PCT) });
    case 'outflow':
      return t('{pct} kept out of landfill', { pct: fmtPct(p.raw!, 0) });
    case 'life':
      return t('{x}× the life and use of a typical product', { x: fmtNum(p.raw!) }) + (p.coverage && p.coverage.measured < p.coverage.total ? ` · ${t('{n} of {total} products sold have this filled in', { n: p.coverage.measured, total: p.coverage.total })}` : '');
    case 'productivity':
      return p.raw === null ? t('No new material used') : t('{amount} revenue per kg of new material', { amount: fmtMoney2(p.raw) });
    case 'businessModel':
      return t('{pct} of revenue', { pct: fmtPct(p.raw!, 0) });
  }
}

export function ScoreBreakdown({ onAddWaste }: { onAddWaste: () => void }) {
  const t = useT();
  const navigate = useNavigate();
  const { score, scorePrev } = useStore();
  const change = score.score !== null && scorePrev.score !== null ? score.score - scorePrev.score : null;
  const levels: { key: ScoreLevel; from: number; to: number }[] = [
    { key: 'starter', from: LEVEL_FROM.starter, to: LEVEL_FROM.grower - 1 },
    { key: 'grower', from: LEVEL_FROM.grower, to: LEVEL_FROM.leader - 1 },
    { key: 'leader', from: LEVEL_FROM.leader, to: 100 },
  ];
  const action: Partial<Record<PillarKey, { label: string; run: () => void }>> = {
    outflow: { label: t('Record waste'), run: onAddWaste },
    life: { label: t('Open products'), run: () => navigate('/app/products') },
    businessModel: { label: t('Record revenue'), run: () => navigate('/app/money?new=txn') },
  };
  return (
    <Card className="p-5 sm:p-6" data-testid="score-breakdown">
      <div className="grid gap-6 lg:grid-cols-[auto_1fr_auto] lg:items-start">
        <div className="flex flex-col items-center text-center lg:w-48">
          <Gauge value={score.score} size={148} stroke={12} label={t('of 100')} bands={[LEVEL_FROM.grower, LEVEL_FROM.leader]} />
          <p className="mt-2 text-sm font-semibold">
            <Term label={t('Circularity score')}>
              <ScoreExplainer />
            </Term>
          </p>
          {score.level && (
            <Badge tone={levelTone(score.level)} dot className="mt-1.5">
              {levelName(score.level)}
            </Badge>
          )}
          {change !== null && Math.abs(change) >= 1 && (
            <p className="muted mt-1.5 text-xs">{change > 0 ? t('Up {n} points from the 30 days before.', { n: change }) : t('Down {n} points from the 30 days before.', { n: -change })}</p>
          )}
          {score.range && score.range[0] !== score.range[1] && (
            <p className="muted mt-2 text-xs" data-testid="score-range">
              <Term label={t('Between {a} and {b} depending on the method', { a: score.range[0], b: score.range[1] })}>
                <p>{t('Your score uses a geometric mean, so one weak pillar pulls it down. Simply averaging the pillars instead would give {n}.', { n: score.linear! })}</p>
                <p>{t('Showing both is a check the research recommends: the closer they are, the more balanced your business is across the pillars.')}</p>
              </Term>
            </p>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="card-title">{t('The five pillars of your score')}</h3>
            <Badge tone="blue">{t('Research-based · {version}', { version: SCORE_VERSION })}</Badge>
          </div>
          <p className="muted mt-1 text-sm">{t('Each pillar is scored from 0 to 100 and counts equally. Pillars without data yet are left out instead of counted as zero.')}</p>
          <ul className="mt-4 space-y-4">
            {score.pillars.map((p) => {
              const copy = PILLAR_COPY[p.key];
              const raw = rawText(t, p);
              const act = action[p.key];
              return (
                <li key={p.key} data-testid={`pillar-${p.key}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <Term label={t(copy.label)}>
                      <p>{t(copy.explain)}</p>
                      <p className="text-gray-300">{t('How to raise it: {tip}', { tip: t(copy.tip) })}</p>
                      <p className="text-xs text-gray-400">{t('Based on: {source}', { source: copy.source })}</p>
                    </Term>
                    <span className={clsx('text-sm font-semibold tabular-nums', p.value === null && 'font-normal text-gray-400')}>{p.value === null ? t('not measured yet') : Math.round(p.value * 100)}</span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
                    {p.value !== null && <div className="h-full rounded-full bg-brand-600 transition-all duration-700 dark:bg-brand-400" style={{ width: `${p.value * 100}%` }} />}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="muted">{raw ?? t(copy.missing)}</span>
                    {act && (p.value === null || p.value < 0.5) && (
                      <button className="font-medium text-brand-700 hover:underline dark:text-brand-300" onClick={act.run}>
                        {act.label}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="lg:w-56">
          <h3 className="card-title">
            <Term label={t('Levels')}>{t('Your score puts your business at one of three levels. Each one is a step toward a fully circular business.')}</Term>
          </h3>
          <ol className="mt-3 space-y-2">
            {[...levels].reverse().map((l) => (
              <li
                key={l.key}
                className={clsx(
                  'flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm',
                  score.level === l.key ? 'border-brand-300 bg-brand-50 font-semibold dark:border-brand-500/40 dark:bg-brand-500/10' : 'border-gray-100 dark:border-white/5',
                )}
              >
                <span>{levelName(l.key)}</span>
                <span className="muted text-xs tabular-nums">
                  {l.from}–{l.to}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Card>
  );
}

/** How the score is built, and the research it rests on. */
export function ResearchBasis() {
  const t = useT();
  return (
    <Card className="p-5" data-testid="research-basis">
      <details>
        <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold">
          <BookOpen className="h-4 w-4 text-brand-600 dark:text-brand-400" /> {t('How the score is built')}
          <span className="muted ms-auto text-xs font-normal">{t('Show')}</span>
        </summary>
        <div className="mt-4 grid gap-6 text-sm leading-relaxed lg:grid-cols-2">
          <ol className="list-decimal space-y-2 ps-5">
            <li>{t('Five pillars, each based on a published measure used by companies (listed on the right).')}</li>
            <li>{t('Each pillar is scored from 0 to 100, and the five pillars count equally (20% each).')}</li>
            <li>{t('The pillars are combined with a geometric mean, so a business with recycled materials but no plan for waste is not called “half circular”.')}</li>
            <li>{t('A pillar with no data yet is left out and marked “not measured yet”. A pillar measured at zero counts as 1, so the score still reacts to the others. You need at least two measured pillars for a score.')}</li>
            <li>{t('Waste and returned products are valued by how high they stay on the R-ladder: reuse or repair 100%, refurbish or remanufacture 75%, recycle or compost 50%, energy recovery 25%, landfill 0%.')}</li>
            <li>{t('Resource productivity is compared on a scale from {min} to {max} per kg of new material until industry benchmarks are available.', { min: fmtMoney2(PRODUCTIVITY_RANGE.min), max: fmtMoney2(PRODUCTIVITY_RANGE.max) })}</li>
            <li>{t('The method follows the ISO 59020 (2024) standard for measuring circularity and the OECD/JRC handbook for building composite scores.')}</li>
            <li className="text-amber-700 dark:text-amber-300">{t('Still to confirm with experts: the R-ladder values, the product-life scale, the productivity range and the level thresholds.')}</li>
          </ol>
          <div>
            <p className="font-semibold">{t('Sources')}</p>
            <ul className="muted mt-2 space-y-1.5 text-xs">
              <li>ISO 59020:2024 — Circular economy: Measuring and assessing circularity performance.</li>
              <li>Ellen MacArthur Foundation &amp; Granta Design (2015, rev. 2019). Material Circularity Indicator.</li>
              <li>WBCSD (2021). Circular Transition Indicators v2.0.</li>
              <li>OECD &amp; JRC (2008). Handbook on Constructing Composite Indicators.</li>
              <li>Potting, Hekkert, Worrell &amp; Hanemaaijer (2017). Circular Economy: Measuring Innovation in the Product Chain (R-ladder). PBL Netherlands.</li>
              <li>MSCI Circular Economy Indexes; ECPI Circular Economy Leaders Index.</li>
              <li>Circle Economy &amp; Deloitte (2025). Circularity Gap Report 2025.</li>
            </ul>
          </div>
        </div>
      </details>
    </Card>
  );
}

function WasteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const { addWaste } = useStore();
  const [description, setDescription] = useState('');
  const [kg, setKg] = useState('');
  const [route, setRoute] = useState<RecoveryRoute>('Recycle or compost');
  const [date, setDate] = useState(toISO(startOfToday()));
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (open) {
      setDescription('');
      setKg('');
      setRoute('Recycle or compost');
      setDate(toISO(startOfToday()));
      setTouched(false);
    }
  }, [open]);
  const n = +kg;
  const save = () => {
    setTouched(true);
    if (!description.trim() || !(n > 0)) return;
    addWaste({ description: description.trim(), kg: n, route, date });
    onClose();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={t('Record waste or returned products')}
      sub={t('For example fabric scraps, packaging, or products customers brought back.')}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            {t('Cancel')}
          </button>
          <button className="btn-primary" onClick={save}>
            {t('Add')}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={t('What was it?')} error={touched && !description.trim() ? t('Give it a name') : null}>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('Fabric scraps')} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('Weight (kg)')} error={touched && !(n > 0) ? t('Amount must be greater than 0') : null}>
            <input type="number" min={0} step="0.1" className="input" value={kg} onChange={(e) => setKg(e.target.value)} />
          </Field>
          <Field label={t('Date')}>
            <input type="date" className="input" value={date} max={toISO(startOfToday())} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <Field label={t('Where did it go?')} hint={t('Higher up the list keeps more value and counts more toward your score.')}>
          <select className="input" value={route} onChange={(e) => setRoute(e.target.value as RecoveryRoute)}>
            {ROUTES.map((r) => (
              <option key={r} value={r}>
                {t(r)} ({fmtPct(ROUTE_WEIGHT[r] * 100, 0)})
              </option>
            ))}
          </select>
        </Field>
      </div>
    </Modal>
  );
}

const routeTone = (r: RecoveryRoute) => (ROUTE_WEIGHT[r] >= 0.75 ? 'green' : ROUTE_WEIGHT[r] >= 0.5 ? 'blue' : ROUTE_WEIGHT[r] > 0 ? 'amber' : 'red');

/** Production waste and returned products, and where they went: the data behind circular outflow. */
export function WasteLog({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const t = useT();
  const { wasteLog, removeWaste } = useStore();
  const from = toISO(lastNDays(30).from);
  const recent = wasteLog.filter((w) => w.date >= from);
  const total = recent.reduce((s, w) => s + w.kg, 0);
  const kept = recent.filter((w) => w.route !== 'Landfill or incineration').reduce((s, w) => s + w.kg, 0);
  const rows = [...wasteLog].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
  return (
    <Card className="flex h-full flex-col" data-testid="waste-log">
      <CardHeader
        title={
          <Term label={t('Waste & returned products')}>
            <p>{t('Record your production waste and any products customers bring back, and where they went. This is how Tokuma measures circular outflow.')}</p>
            <p>{t('A rough weight is fine: weigh a bag of scraps once and estimate from there.')}</p>
          </Term>
        }
        sub={recent.length ? t('Last 30 days: {kg} recorded, {pct} kept out of landfill', { kg: fmtKg(total), pct: fmtPct((kept / total) * 100, 0) }) : t('Nothing recorded in the last 30 days')}
        right={
          <button className="btn-secondary btn-sm" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> {t('Record waste')}
          </button>
        }
      />
      {rows.length === 0 ? (
        <EmptyState icon={<Trash2 className="h-6 w-6" />} title={t('No waste recorded yet')} body={t('Add your scraps, packaging and returned products to measure your circular outflow.')} />
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">{t('Date')}</th>
                <th className="th">{t('What')}</th>
                <th className="th text-end">{t('Weight')}</th>
                <th className="th">{t('Where it went')}</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w.id} className="tr">
                  <td className="td whitespace-nowrap text-gray-500">{fmtDate(w.date)}</td>
                  <td className="td">{w.description}</td>
                  <td className="td text-end tabular-nums">{fmtKg(w.kg)}</td>
                  <td className="td">
                    <Badge tone={routeTone(w.route)}>{t(w.route)}</Badge>
                  </td>
                  <td className="td text-end">
                    <button className="icon-btn h-7 w-7" onClick={() => removeWaste(w.id)} aria-label={t('Remove {name}', { name: w.description })}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <WasteModal open={open} onClose={() => setOpen(false)} />
    </Card>
  );
}
