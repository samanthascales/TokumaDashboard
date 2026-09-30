import { useEffect, useMemo, useState } from 'react';
import { NavLink, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowUpDown, Award, Clock, Factory, Globe2, Leaf, Pencil, Plus, ShieldCheck, Truck } from 'lucide-react';
import { useStore } from '../store/AppStore';
import { useSimulatedLoad } from '../lib/hooks';
import { fmtCompact, fmtInt, fmtNum, fmtPct } from '../lib/format';
import { t as tr, useT } from '../i18n';
import { avgKnown, certificationScore, leadTimeScore, reliabilityScore, riskLevel } from '../lib/metrics';
import { Badge, Card, CardHeader, CardSkeleton, EmptyState, Gauge, Modal, PageHeader, StatusBadge, TableSkeleton, Tip } from '../components/ui';
import { SupplierModal } from './supply/SupplierModal';
import type { Supplier } from '../types';

function Tabs() {
  const t = useT();
  const cls = ({ isActive }: { isActive: boolean }) =>
    clsx('-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition', isActive ? 'border-brand-600 text-gray-900 dark:border-brand-400 dark:text-white' : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200');
  return (
    <div className="mt-5 flex gap-1 border-b border-gray-200 dark:border-white/10">
      <NavLink to="/app/supply-chain" end className={cls}>
        {t('Overview')}
      </NavLink>
      <NavLink to="/app/supply-chain/reliability" className={cls}>
        {t('Supplier reliability')}
      </NavLink>
    </div>
  );
}

const riskTone = { Low: 'green', Moderate: 'amber', High: 'red', 'Needs data': 'gray' } as const;
const riskLabel = (score: number | null) => {
  const r = riskLevel(score);
  return r === 'Needs data' ? tr('Needs data') : r === 'Low' ? tr('Low risk') : r === 'Moderate' ? tr('Moderate risk') : tr('High risk');
};
/** Show a measured value, or a dash when it wasn't entered. */
const show = (v: number | null, unit = '') => (v === null ? '—' : unit === '%' ? fmtPct(v, 0) : `${v}${unit}`);

function Overview({ onOpen }: { onOpen: (s: Supplier) => void }) {
  const t = useT();
  const { suppliers } = useStore();
  // Totals and averages only include values that were actually entered.
  const withCarbon = suppliers.filter((x) => x.carbonEmissionsKg !== null);
  const totalCarbon = withCarbon.reduce((s, x) => s + (x.carbonEmissionsKg ?? 0), 0);
  const avgSust = avgKnown(suppliers.map((x) => x.sustainabilityRating));
  const scores = suppliers.map((x) => reliabilityScore(x));
  const avgRel = avgKnown(scores);
  const highRisk = scores.filter((x) => x !== null && x < 65).length;
  const byCountry = useMemo(() => {
    const m = new Map<string, { country: string; suppliers: Supplier[]; carbon: number }>();
    for (const s of suppliers) {
      const cur = m.get(s.country) ?? { country: s.country, suppliers: [], carbon: 0 };
      cur.suppliers.push(s);
      cur.carbon += s.carbonEmissionsKg ?? 0;
      m.set(s.country, cur);
    }
    return [...m.values()].sort((a, b) => b.carbon - a.carbon);
  }, [suppliers]);
  const modes = (['Sea', 'Rail', 'Road', 'Air'] as const).map((mode) => {
    const list = suppliers.filter((s) => s.transportMethod === mode);
    const known = list.filter((x) => x.carbonEmissionsKg !== null);
    return { mode, count: list.length, carbon: known.reduce((s, x) => s + (x.carbonEmissionsKg ?? 0), 0), hasCarbon: known.length > 0 };
  });

  const tiles = [
    { label: t('Sustainability rating'), value: avgSust === null ? '—' : `${Math.round(avgSust)}/100`, sub: avgSust === null ? t('no ratings entered yet') : t('avg of entered ratings'), icon: Leaf },
    {
      label: t('Logistics carbon'),
      value: withCarbon.length ? `${fmtCompact(totalCarbon)} kg` : '—',
      sub: withCarbon.length ? t('CO₂e per year · {n} of {total} suppliers', { n: withCarbon.length, total: suppliers.length }) : t('no carbon figures entered yet'),
      icon: Truck,
    },
    { label: t('Avg reliability'), value: avgRel === null ? '—' : `${Math.round(avgRel)}/100`, sub: avgRel === null ? t('needs lead time + on-time delivery') : t('{count} high-risk suppliers', { count: highRisk }), icon: ShieldCheck },
    { label: t('Suppliers'), value: suppliers.length, sub: t('{count} countries', { count: byCountry.length }), icon: Factory },
  ];

  return (
    <div className="grid grid-cols-12 gap-5">
      {tiles.map((x) => (
        <Card key={x.label} className="col-span-6 p-5 lg:col-span-3">
          <p className="muted flex items-center gap-1.5 text-xs">
            <x.icon className="h-3.5 w-3.5" /> {x.label}
          </p>
          <p className="num mt-2 text-[26px] leading-none">{x.value}</p>
          <p className="muted mt-1.5 text-[11px]">{x.sub}</p>
        </Card>
      ))}

      <Card className="col-span-12 lg:col-span-8">
        <CardHeader title={t('Key suppliers')} sub={t('Click any supplier for details')} />
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          {suppliers.map((s) => {
            const score = reliabilityScore(s);
            return (
              <button key={s.id} onClick={() => onOpen(s)} className="flex items-center gap-4 rounded-xl border border-gray-100 p-3 text-start transition hover:border-gray-200 hover:shadow-card dark:border-white/5 dark:hover:border-white/10">
                <Gauge value={score} size={68} stroke={7} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{s.name}</p>
                  <p className="muted text-xs">
                    {[s.city, s.country].filter(Boolean).join(', ')} · {t(s.transportMethod)}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <Badge tone={riskTone[riskLevel(score)]}>{riskLabel(score)}</Badge>
                    {s.certifications.slice(0, 2).map((c) => (
                      <Badge key={c}>{c}</Badge>
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="col-span-12 lg:col-span-4">
        <CardHeader title={t('Transport mix')} sub={t('Share of logistics carbon by mode')} />
        <div className="space-y-3 p-5">
          {modes.map((m) => (
            <div key={m.mode}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{t(m.mode)}</span>
                <span className="muted text-xs tabular-nums">
                  {t('{count} suppliers', { count: m.count })} · {m.hasCarbon ? `${fmtInt(m.carbon)} kg` : '—'}
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
                <div className="h-full rounded-full bg-brand-600 transition-all duration-700 dark:bg-brand-400" style={{ width: `${totalCarbon ? (m.carbon / totalCarbon) * 100 : 0}%` }} />
              </div>
            </div>
          ))}
          <p className="muted pt-2 text-xs">
            {t('Air freight is ~20× more carbon-intensive per tonne-km than rail.')}{' '}
            {(() => {
              const air = suppliers.filter((s) => s.transportMethod === 'Air').sort((a, b) => (b.carbonEmissionsKg ?? 0) - (a.carbonEmissionsKg ?? 0))[0];
              return air ? t('Moving {name} to sea or rail is your biggest carbon lever.', { name: air.name }) : t('No air-freight suppliers — nice.');
            })()}
          </p>
        </div>
      </Card>

      <Card className="col-span-12">
        <CardHeader title={t('Material origins')} sub={t('Where your inputs come from')} />
        <div className="overflow-x-auto p-2">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">{t('Country')}</th>
                <th className="th">{t('Suppliers')}</th>
                <th className="th">{t('Materials')}</th>
                <th className="th text-end">{t('Carbon (kg)')}</th>
              </tr>
            </thead>
            <tbody>
              {byCountry.map((c) => (
                <tr key={c.country} className="tr">
                  <td className="td font-medium">
                    <span className="flex items-center gap-2">
                      <Globe2 className="h-4 w-4 text-gray-400" /> {c.country}
                    </span>
                  </td>
                  <td className="td">{c.suppliers.map((s) => s.name).join(', ')}</td>
                  <td className="td">
                    <div className="flex flex-wrap gap-1">
                      {[...new Set(c.suppliers.flatMap((s) => s.materialsSupplied))].map((m) => (
                        <Badge key={m}>{m}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="td text-end tabular-nums">{c.suppliers.some((s) => s.carbonEmissionsKg !== null) ? fmtInt(c.carbon) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

type SortKey = 'reliability' | 'lead' | 'ontime' | 'sustainability' | 'name';

function Reliability({ onOpen }: { onOpen: (s: Supplier) => void }) {
  const t = useT();
  const { suppliers, products } = useStore();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'reliability', dir: -1 });
  const val = (s: Supplier, k: SortKey) => (k === 'reliability' ? reliabilityScore(s) : k === 'lead' ? s.avgLeadTimeDays : k === 'ontime' ? s.onTimeDeliveryRate : k === 'sustainability' ? s.sustainabilityRating : s.name);
  const rows = [...suppliers].sort((a, b) => {
    const va = val(a, sort.key);
    const vb = val(b, sort.key);
    // Suppliers missing the sorted value always go last.
    if (va === null || vb === null) return va === vb ? 0 : va === null ? 1 : -1;
    return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
  });
  const th = (k: SortKey, label: string, right = true) => (
    <th className={clsx('th', right && 'text-end')}>
      <button
        className={clsx('inline-flex items-center gap-1 hover:text-gray-900 dark:hover:text-white', sort.key === k && 'text-gray-900 dark:text-white')}
        onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? (-s.dir as 1 | -1) : k === 'lead' || k === 'name' ? 1 : -1 }))}
      >
        {label}
        <ArrowUpDown className="h-3 w-3" />
      </button>
    </th>
  );

  return (
    <div className="space-y-5">
      <Card className="flex flex-col gap-4 p-5 md:flex-row md:items-center">
        <div className="flex-1">
          <h3 className="card-title">{t('How reliability is scored')}</h3>
          <p className="mt-1 font-mono text-sm text-gray-700 dark:text-gray-300" dir="ltr">
            0.3 × <span className="text-brand-700 dark:text-brand-300">leadTimeScore</span> + 0.5 × <span className="text-brand-700 dark:text-brand-300">onTimeDelivery</span> + 0.2 × <span className="text-brand-700 dark:text-brand-300">certificationScore</span>
          </p>
          <p className="muted mt-1 text-xs">{t("Lead-time score is 100 at ≤5 days, falling to 0 at 45 days. Each certification adds 35 points (max 100). A supplier's lead time also drives the reorder point of every product linked to it.")}</p>
        </div>
        <div className="flex gap-2">
          <Badge tone="green">≥ 80 {t('Low risk')}</Badge>
          <Badge tone="amber">65–79 {t('Moderate')}</Badge>
          <Badge tone="red">&lt; 65 {t('High')}</Badge>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {[...suppliers]
          .sort((a, b) => (reliabilityScore(b) ?? -1) - (reliabilityScore(a) ?? -1))
          .map((s) => (
            <Card key={s.id} hover className="flex cursor-pointer flex-col items-center p-4 text-center" onClick={() => onOpen(s)}>
              <Gauge value={reliabilityScore(s)} size={104} label={t('reliability')} />
              <p className="mt-2 truncate text-sm font-semibold">{s.name}</p>
              <p className="muted text-[11px]">
                {t('{days} lead', { days: s.avgLeadTimeDays === null ? '—' : t('{n}d', { n: s.avgLeadTimeDays }) })} · {t('{pct} on-time', { pct: show(s.onTimeDeliveryRate, '%') })}
              </p>
            </Card>
          ))}
      </div>

      <Card className="overflow-hidden">
        <CardHeader title={t('All suppliers')} sub={t('Sort by reliability, lead time, on-time rate or sustainability')} />
        <div className="mt-3 overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50/60 dark:bg-white/[0.02]">
              <tr>
                {th('name', t('Supplier'), false)}
                {th('reliability', t('Reliability'))}
                {th('lead', t('Lead time'))}
                {th('ontime', t('On-time'))}
                {th('sustainability', t('Sustainability'))}
                <th className="th">{t('Certifications')}</th>
                <th className="th">{t('Risk')}</th>
                <th className="th text-end">{t('Linked products')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const score = reliabilityScore(s);
                const linked = products.filter((p) => p.supplierId === s.id);
                return (
                  <tr key={s.id} className="tr cursor-pointer" onClick={() => onOpen(s)}>
                    <td className="td">
                      <p className="font-medium">{s.name}</p>
                      <p className="muted text-xs">
                        {[s.city, s.country].filter(Boolean).join(', ')} · {t(s.transportMethod)}
                      </p>
                    </td>
                    <td className="td text-end">
                      <div className="inline-flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
                          <div className={clsx('h-full rounded-full', score === null ? '' : score >= 80 ? 'bg-brand-600 dark:bg-brand-400' : score >= 65 ? 'bg-amber-400' : 'bg-red-500')} style={{ width: `${score ?? 0}%` }} />
                        </div>
                        <span className="w-8 font-semibold tabular-nums">{score ?? '—'}</span>
                      </div>
                    </td>
                    <td className="td text-end tabular-nums">{s.avgLeadTimeDays === null ? '—' : t('{n}d', { n: s.avgLeadTimeDays })}</td>
                    <td className="td text-end tabular-nums">{show(s.onTimeDeliveryRate, '%')}</td>
                    <td className="td text-end tabular-nums">{show(s.sustainabilityRating)}</td>
                    <td className="td">
                      <div className="flex gap-1">
                        {s.certifications.map((c) => (
                          <Badge key={c}>{c}</Badge>
                        ))}
                        {!s.certifications.length && <span className="text-gray-400">—</span>}
                      </div>
                    </td>
                    <td className="td">
                      <Badge tone={riskTone[riskLevel(score)]} dot>
                        {t(riskLevel(score))}
                      </Badge>
                    </td>
                    <td className="td text-end tabular-nums">{linked.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function SupplierDetail({ supplier, onClose, onEdit }: { supplier: Supplier | null; onClose: () => void; onEdit: (s: Supplier) => void }) {
  const t = useT();
  const { inventory, role } = useStore();
  if (!supplier) return null;
  const score = reliabilityScore(supplier);
  const linked = inventory.filter((r) => r.product.supplierId === supplier.id);
  const parts = [
    {
      label: t('Lead-time score'),
      raw: supplier.avgLeadTimeDays === null ? null : leadTimeScore(supplier.avgLeadTimeDays),
      w: 0.3,
      icon: Clock,
      detail: supplier.avgLeadTimeDays === null ? t('not entered') : t('{count} days', { count: supplier.avgLeadTimeDays }),
    },
    { label: t('On-time delivery'), raw: supplier.onTimeDeliveryRate, w: 0.5, icon: Truck, detail: supplier.onTimeDeliveryRate === null ? t('not entered') : fmtPct(supplier.onTimeDeliveryRate, 0) },
    { label: t('Certification score'), raw: certificationScore(supplier.certifications), w: 0.2, icon: Award, detail: supplier.certifications.join(', ') || t('None') },
  ];
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={supplier.name}
      sub={`${[supplier.city, supplier.country].filter(Boolean).join(', ')} · ${t('ships by {mode}', { mode: t(supplier.transportMethod).toLowerCase() })}`}
      footer={
        role === 'business' && (
          <button className="btn-secondary" onClick={() => onEdit(supplier)}>
            <Pencil className="h-4 w-4" /> {t('Edit supplier')}
          </button>
        )
      }
    >
      <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center">
          <Gauge value={score} size={132} label={t('reliability')} />
          <Badge tone={riskTone[riskLevel(score)]} className="mt-2">
            {riskLabel(score)}
          </Badge>
        </div>
        <div className="space-y-3">
          {parts.map((p) => (
            <div key={p.label}>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <p.icon className="h-4 w-4 text-gray-400" /> {p.label}
                  <span className="muted text-xs">({p.detail})</span>
                </span>
                <span className="font-semibold tabular-nums">
                  {p.raw === null ? '—' : <>{Math.round(p.raw)} <span className="muted font-normal">× {fmtNum(p.w)} = {fmtNum(p.raw * p.w)}</span></>}
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
                <div className="h-full rounded-full bg-brand-600 transition-all duration-700 dark:bg-brand-400" style={{ width: `${p.raw ?? 0}%` }} />
              </div>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3 pt-2 text-sm">
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-white/[0.03]">
              <p className="muted text-xs">{t('Sustainability')}</p>
              <p className="num text-lg">{supplier.sustainabilityRating === null ? '—' : `${supplier.sustainabilityRating}/100`}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-white/[0.03]">
              <p className="muted text-xs">{t('Logistics carbon')}</p>
              <p className="num text-lg">{supplier.carbonEmissionsKg === null ? '—' : `${fmtInt(supplier.carbonEmissionsKg)} kg`}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">{t('Linked products · reorder points use this lead time')}</p>
        {linked.length === 0 ? (
          <p className="muted text-sm">{t('No products linked to this supplier yet.')}</p>
        ) : (
          <table className="w-full">
            <tbody>
              {linked.map((r) => (
                <tr key={r.product.id} className="tr">
                  <td className="td ps-0 font-medium">{r.product.name}</td>
                  <td className="td text-end tabular-nums">
                    {r.reorderPoint === null ? (
                      <span className="muted">{t('No reorder point — lead time not entered')}</span>
                    ) : (
                      <Tip content={t('({avg}/day × {lead}d) + {safety}', { avg: fmtNum(r.avgDaily, 2), lead: r.leadTime!, safety: r.product.safetyStock })}>
                        <span className="border-b border-dashed border-gray-300 dark:border-gray-600">{t('ROP {n}', { n: r.reorderPoint })}</span>
                      </Tip>
                    )}
                  </td>
                  <td className="td text-end tabular-nums">{t('{n} on hand', { n: r.product.stockOnHand })}</td>
                  <td className="td pe-0 text-end">
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Modal>
  );
}

export default function SupplyChain({ view }: { view: 'overview' | 'reliability' }) {
  const t = useT();
  const { suppliers, role } = useStore();
  const [params, setParams] = useSearchParams();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const ready = useSimulatedLoad(`supply-${view}`);

  useEffect(() => {
    const open = params.get('open');
    if (open) setDetailId(open);
    if (params.get('new') === 'supplier') setAdding(true);
    if (open || params.get('new')) setParams({}, { replace: true });
  }, [params, setParams]);

  const detail = suppliers.find((s) => s.id === detailId) ?? null;

  return (
    <>
      <PageHeader
        title={view === 'overview' ? t('Supply chain') : t('Supplier reliability')}
        sub={view === 'overview' ? t('Sustainability, carbon and origins across your supplier network') : t('Computed reliability scores, lead times and delivery performance')}
        actions={
          role === 'business' && (
            <button className="btn-primary" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" /> {t('Add supplier')}
            </button>
          )
        }
      >
        <Tabs />
      </PageHeader>
      {!ready ? (
        view === 'overview' ? (
          <div className="grid grid-cols-12 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <CardSkeleton key={i} className="col-span-6 h-[120px] lg:col-span-3" lines={2} />
            ))}
            <CardSkeleton className="col-span-12 h-[340px] lg:col-span-8" lines={8} />
            <CardSkeleton className="col-span-12 h-[340px] lg:col-span-4" lines={8} />
          </div>
        ) : (
          <TableSkeleton rows={6} cols={7} />
        )
      ) : suppliers.length === 0 ? (
        <Card>
          <EmptyState icon={<Truck className="h-6 w-6" />} title={t('No suppliers yet')}
            body={t('Add your first supplier to track sustainability, lead times and reliability — and to power automatic reorder points.')}
            action={
              <button className="btn-primary" onClick={() => setAdding(true)}>
                <Plus className="h-4 w-4" /> {t('Add supplier')}
              </button>
            } />
        </Card>
      ) : view === 'overview' ? (
        <Overview onOpen={(s) => setDetailId(s.id)} />
      ) : (
        <Reliability onOpen={(s) => setDetailId(s.id)} />
      )}
      <SupplierDetail
        supplier={detail}
        onClose={() => setDetailId(null)}
        onEdit={(s) => {
          setDetailId(null);
          setEditing(s);
        }}
      />
      <SupplierModal open={adding || !!editing} supplier={editing} onClose={() => { setAdding(false); setEditing(null); }} />
    </>
  );
}
