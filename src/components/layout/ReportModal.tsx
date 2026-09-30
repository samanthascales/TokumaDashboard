import { useEffect, useMemo, useState } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { Modal } from '../ui';
import { IS_EMBEDDED } from '../../env';
import { fmtDate, fmtDelta, fmtKg, fmtMoney, fmtNum, fmtPct, startOfToday, toISO } from '../../lib/format';
import { useT } from '../../i18n';
import { lastNDays, pctChange, reliabilityScore, totalsFor } from '../../lib/metrics';

export function ReportModal() {
  const [open, setOpen] = useState(false);
  const [building, setBuilding] = useState(false);
  const t = useT();
  const s = useStore();
  const statusLabel = { critical: t('Critical'), reorder: t('Reorder'), healthy: t('Healthy') };

  useEffect(() => {
    const h = () => {
      setOpen(true);
      setBuilding(true);
      setTimeout(() => setBuilding(false), 900);
    };
    window.addEventListener('tokuma:report', h);
    return () => window.removeEventListener('tokuma:report', h);
  }, []);

  const data = useMemo(() => {
    const cur = totalsFor(s.ledger, lastNDays(30));
    const prev = totalsFor(s.ledger, lastNDays(30, 30));
    const yr = totalsFor(s.ledger, lastNDays(365));
    return { cur, prev, yr };
  }, [s.ledger]);

  const rows: [string, string, string][] = [
    [t('Revenue (30d)'), fmtMoney(data.cur.revenue), t('{pct} vs prior', { pct: fmtDelta(pctChange(data.cur.revenue, data.prev.revenue)) })],
    [t('Net profit (30d)'), fmtMoney(data.cur.profit), t('{pct} vs prior', { pct: fmtDelta(pctChange(data.cur.profit, data.prev.profit)) })],
    [t('Revenue (trailing 12m)'), fmtMoney(data.yr.revenue), t('{pct} net margin', { pct: fmtPct((data.yr.profit / (data.yr.revenue || 1)) * 100) })],
    [
      t('Circularity rate'),
      s.circ30.hasData ? fmtPct(s.circ30.rate) : '—',
      s.circ30.hasData && s.circPrev30.hasData ? t('{n} pts vs prior 30d', { n: fmtNum(s.circ30.rate - s.circPrev30.rate) }) : t('needs sales of products with materials'),
    ],
    [t('Circular material'), fmtKg(s.circ30.circularKg), t('{kg} virgin', { kg: fmtKg(s.circ30.virginKg) })],
    [
      t('Funding eligibility'),
      s.funding.ready ? fmtMoney(s.funding.maxEligibility!) : '—',
      s.funding.ready ? t('{apr} est. APR · score {score}', { apr: fmtPct(s.funding.apr!, 2), score: s.funding.score! }) : t('available once sales are logged'),
    ],
  ];

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      size="xl"
      title={
        <span className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-brand-600" /> {t('Circular performance report')}
        </span>
      }
      sub={`${s.profile.businessName || t('Your business')} · ${t('generated {date}', { date: fmtDate(toISO(startOfToday())) })}`}
      footer={
        <>
          <button className="btn-secondary" onClick={() => setOpen(false)}>
            {t('Close')}
          </button>
          {!IS_EMBEDDED && (
            <button className="btn-primary" disabled={building} onClick={() => window.print()}>
              <Download className="h-4 w-4" /> {t('Download PDF')}
            </button>
          )}
        </>
      }
    >
      {building ? (
        <div className="flex flex-col items-center justify-center py-20 text-sm text-gray-500">
          <Loader2 className="mb-3 h-6 w-6 animate-spin text-brand-600" />
          {t('Compiling transactions, materials and supplier data…')}
        </div>
      ) : (
        <div id="print-report" className="space-y-6 text-sm">
          <div className="flex items-start justify-between border-b border-gray-200 pb-4 dark:border-white/10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-400">Tokuma · {s.verification.verified ? t('Verified circular business') : t('Verification in progress')}</p>
              <h3 className="mt-1 text-xl font-bold">{s.profile.businessName || t('Your business')}</h3>
              <p className="muted">
                {t(s.profile.industry)} · {s.profile.country}
              </p>
            </div>
            <div className="text-end text-xs text-gray-500">
              <p>{t('Period: last 30 days')}</p>
              <p>{fmtDate(toISO(startOfToday()))}</p>
            </div>
          </div>

          <section>
            <h4 className="mb-2 font-semibold">{t('Headline metrics')}</h4>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {rows.map(([k, v, sub]) => (
                <div key={k} className="rounded-lg border border-gray-200 p-3 dark:border-white/10">
                  <p className="muted text-xs">{k}</p>
                  <p className="mt-1 text-lg font-bold tabular-nums">{v}</p>
                  <p className="muted text-xs">{sub}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h4 className="mb-2 font-semibold">{t('Product circularity')}</h4>
            <table className="w-full text-start">
              <thead>
                <tr className="text-xs text-gray-500">
                  <th className="py-1.5">{t('Product')}</th>
                  <th>{t('Circularity')}</th>
                  <th>{t('Units (30d)')}</th>
                  <th>{t('Stock')}</th>
                  <th>{t('Status')}</th>
                </tr>
              </thead>
              <tbody>
                {s.inventory.map((r) => (
                  <tr key={r.product.id} className="border-t border-gray-100 dark:border-white/5">
                    <td className="py-1.5">{r.product.name}</td>
                    <td className="tabular-nums">{fmtPct(r.product.circularityScore, 0)}</td>
                    <td className="tabular-nums">{data.cur.units[r.product.id] ?? 0}</td>
                    <td className="tabular-nums">{r.product.stockOnHand}</td>
                    <td>{statusLabel[r.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <h4 className="mb-2 font-semibold">{t('Supplier reliability')}</h4>
            <table className="w-full text-start">
              <thead>
                <tr className="text-xs text-gray-500">
                  <th className="py-1.5">{t('Supplier')}</th>
                  <th>{t('Reliability')}</th>
                  <th>{t('Lead time')}</th>
                  <th>{t('On-time')}</th>
                  <th>{t('Sustainability')}</th>
                </tr>
              </thead>
              <tbody>
                {s.suppliers.map((x) => (
                  <tr key={x.id} className="border-t border-gray-100 dark:border-white/5">
                    <td className="py-1.5">{x.name}</td>
                    <td className="tabular-nums">{reliabilityScore(x) ?? '—'}{reliabilityScore(x) !== null && '/100'}</td>
                    <td className="tabular-nums">{x.avgLeadTimeDays === null ? '—' : t('{count} days', { count: x.avgLeadTimeDays })}</td>
                    <td className="tabular-nums">{x.onTimeDeliveryRate === null ? '—' : fmtPct(x.onTimeDeliveryRate, 0)}</td>
                    <td className="tabular-nums">{x.sustainabilityRating ?? '—'}{x.sustainabilityRating !== null && '/100'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section>
            <h4 className="mb-2 font-semibold">{t('Top recommendations')}</h4>
            <ol className="list-decimal space-y-1 ps-5">
              {s.recs.map((r) => (
                <li key={r.productId + r.materialName}>
                  {t('Switch {material} in {product} to recycled — projected {from} → {to}.', { material: r.materialName, product: r.productName, from: fmtPct(r.current), to: fmtPct(r.projected) })}
                </li>
              ))}
            </ol>
          </section>
          <p className="muted border-t border-gray-200 pt-3 text-xs dark:border-white/10">
            {t("Circularity is calculated from logged sales × each product's bill of materials. Reliability = 0.3 × lead-time score + 0.5 × on-time delivery + 0.2 × certification score.")}
          </p>
        </div>
      )}
    </Modal>
  );
}
