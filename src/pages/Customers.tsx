import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowUpDown, Repeat, Search, UserPlus, Users, UserX, Wallet } from 'lucide-react';
import { useStore } from '../store/AppStore';
import { useSimulatedLoad } from '../lib/hooks';
import { daysBetween, fmtDate, fmtMoney, fmtPct, parseISO, startOfToday } from '../lib/format';
import { useT } from '../i18n';
import { Avatar, Badge, Card, EmptyState, Modal, PageHeader, TableSkeleton, Tabs } from '../components/ui';
import type { CustomerStats } from '../types';

const segTone = { New: 'blue', Repeat: 'green', 'At-risk': 'red' } as const;
type SortKey = 'name' | 'totalSpent' | 'orders' | 'lastOrderDate';

export default function Customers() {
  const t = useT();
  const { customerStats, products, transactions } = useStore();
  const [params, setParams] = useSearchParams();
  const [seg, setSeg] = useState<'All' | CustomerStats['segment']>('All');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'totalSpent', dir: -1 });
  const [openId, setOpenId] = useState<string | null>(null);
  const ready = useSimulatedLoad('customers');

  useEffect(() => {
    const o = params.get('open');
    if (o) {
      setOpenId(o);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const productName = useMemo(() => new Map(products.map((p) => [p.id, p.name])), [products]);
  const withOrders = customerStats.filter((c) => c.orders > 0);
  const repeatRate = withOrders.length ? (withOrders.filter((c) => c.orders > 1).length / withOrders.length) * 100 : 0;
  const ltv = withOrders.length ? withOrders.reduce((s, c) => s + c.totalSpent, 0) / withOrders.length : 0;
  const counts = { New: 0, Repeat: 0, 'At-risk': 0 } as Record<CustomerStats['segment'], number>;
  customerStats.forEach((c) => counts[c.segment]++);

  const rows = customerStats
    .filter((c) => (seg === 'All' || c.segment === seg) && `${c.name} ${c.email}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => {
      const va = a[sort.key] ?? '';
      const vb = b[sort.key] ?? '';
      return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
    });

  const th = (k: SortKey, label: string, right?: boolean) => (
    <th className={clsx('th', right && 'text-end')}>
      <button className={clsx('inline-flex items-center gap-1 hover:text-gray-900 dark:hover:text-white', sort.key === k && 'text-gray-900 dark:text-white')} onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? (-s.dir as 1 | -1) : -1 }))}>
        {label}
        <ArrowUpDown className="h-3 w-3" />
      </button>
    </th>
  );

  const open = customerStats.find((c) => c.id === openId);
  const history = useMemo(() => (open ? transactions.filter((x) => x.customerId === open.id).sort((a, b) => b.date.localeCompare(a.date)) : []), [open, transactions]);

  return (
    <>
      <PageHeader title={t('Customers')} sub={t('Segments update from purchase recency and frequency — every sale is linked to the products bought')} />
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: t('Customers'), value: customerStats.length, icon: Users, sub: t('{count} new in the last 60 days', { count: counts.New }) },
          { label: t('Repeat purchase rate'), value: fmtPct(repeatRate, 0), icon: Repeat, sub: t('bought on 2+ separate days') },
          { label: t('Avg lifetime value'), value: fmtMoney(ltv), icon: Wallet, sub: t('per purchasing customer') },
          { label: t('At-risk'), value: counts['At-risk'], icon: UserX, sub: t('no order in 90+ days') },
        ].map((k) => (
          <Card key={k.label} className="p-4">
            <p className="muted flex items-center gap-1.5 text-xs">
              <k.icon className="h-3.5 w-3.5" /> {k.label}
            </p>
            <p className="num mt-1 text-2xl">{k.value}</p>
            <p className="muted text-[11px]">{k.sub}</p>
          </Card>
        ))}
      </div>
      {!ready ? (
        <TableSkeleton rows={8} cols={6} />
      ) : (
        <Card className="overflow-hidden">
          <div className="px-5 pt-3">
            <Tabs
              value={seg}
              onChange={setSeg}
              tabs={[
                { value: 'All', label: t('All'), count: customerStats.length },
                { value: 'Repeat', label: t('Repeat'), count: counts.Repeat },
                { value: 'New', label: t('New'), count: counts.New },
                { value: 'At-risk', label: t('At-risk'), count: counts['At-risk'] },
              ]}
            />
          </div>
          <div className="px-5 py-4">
            <div className="relative max-w-xs">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input className="input ps-9" placeholder={t('Search name or email')} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          {rows.length === 0 ? (
            <EmptyState icon={<UserPlus className="h-6 w-6" />} title={t('No customers here')} body={t('Customers appear automatically when you log a sale linked to them.')} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50/60 dark:bg-white/[0.02]">
                  <tr>
                    {th('name', t('Customer'))}
                    <th className="th">{t('Segment')}</th>
                    <th className="th">{t('Products purchased')}</th>
                    {th('orders', t('Orders'), true)}
                    {th('totalSpent', t('Total spent'), true)}
                    {th('lastOrderDate', t('Last order'), true)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id} className="tr cursor-pointer" onClick={() => setOpenId(c.id)}>
                      <td className="td">
                        <div className="flex items-center gap-3">
                          <Avatar name={c.name} />
                          <div>
                            <p className="font-medium">{c.name}</p>
                            <p className="muted text-xs">{c.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="td">
                        <Badge tone={segTone[c.segment]} dot>
                          {t(c.segment)}
                        </Badge>
                      </td>
                      <td className="td">
                        <div className="flex max-w-[320px] flex-wrap gap-1">
                          {c.productsPurchased.slice(0, 3).map((id) => (
                            <Badge key={id}>{productName.get(id) ?? t('Archived')}</Badge>
                          ))}
                          {c.productsPurchased.length > 3 && <Badge>+{c.productsPurchased.length - 3}</Badge>}
                          {!c.productsPurchased.length && <span className="text-gray-400">—</span>}
                        </div>
                      </td>
                      <td className="td text-end tabular-nums">{c.orders}</td>
                      <td className="td text-end font-semibold tabular-nums">{fmtMoney(c.totalSpent)}</td>
                      <td className="td text-end text-gray-500">
                        {c.lastOrderDate ? (
                          <>
                            {fmtDate(c.lastOrderDate)}
                            <span className="block text-[11px]">{t('{n}d ago', { n: daysBetween(parseISO(c.lastOrderDate), startOfToday()) })}</span>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
      <Modal open={!!open} onClose={() => setOpenId(null)} size="lg" title={open?.name ?? ''} sub={open ? [open.email, open.city, t('customer since {date}', { date: fmtDate(open.joinedDate) })].filter(Boolean).join(' · ') : ''}>
        {open && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                [
                  t('Segment'),
                  <Badge key="s" tone={segTone[open.segment]} dot>
                    {t(open.segment)}
                  </Badge>,
                ],
                [t('Orders'), open.orders],
                [t('Total spent'), fmtMoney(open.totalSpent)],
                [t('Avg order'), fmtMoney(open.avgOrderValue)],
              ].map(([k, v]) => (
                <div key={k as string} className="rounded-lg border border-gray-200 p-3 dark:border-white/10">
                  <p className="muted text-xs">{k}</p>
                  <div className="num mt-1 text-lg">{v}</div>
                </div>
              ))}
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">{t('Purchase history')}</p>
              <div className="scrollbar-thin max-h-72 overflow-y-auto rounded-lg border border-gray-200 dark:border-white/10">
                <table className="w-full">
                  <tbody>
                    {history.map((x) => (
                      <tr key={x.id} className="tr">
                        <td className="td text-gray-500">{fmtDate(x.date)}</td>
                        <td className="td">
                          {x.productId ? productName.get(x.productId) : t(x.category)}
                          {x.quantity && <span className="muted"> × {x.quantity}</span>}
                        </td>
                        <td className="td text-end font-medium tabular-nums">{fmtMoney(x.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!history.length && <p className="muted p-4 text-sm">{t('No purchases yet.')}</p>}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
