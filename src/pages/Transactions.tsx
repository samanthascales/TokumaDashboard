import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Download, Link2, Plus, Receipt, Search, Upload } from 'lucide-react';
import { ImportModal } from './transactions/ImportModal';
import { useStore } from '../store/AppStore';
import { IS_EMBEDDED } from '../env';
import { useSimulatedLoad } from '../lib/hooks';
import { fmtDate, fmtInt, fmtMoney, fmtMoney2, fmtPct, startOfToday, toISO } from '../lib/format';
import { t as tr, tk, useT } from '../i18n';
import { lastNDays, totalsFor } from '../lib/metrics';
import { Badge, Card, EmptyState, Field, Modal, PageHeader, Segmented, TableSkeleton } from '../components/ui';
import type { Transaction } from '../types';

const INFLOW_CATS = [tk('Product sale'), tk('Grant'), tk('Loan'), tk('Repair service'), tk('Other income')];
const OUTFLOW_CATS = [tk('Materials'), tk('Logistics'), tk('Payroll'), tk('Rent & utilities'), tk('Marketing'), tk('Packaging'), tk('Inventory purchase'), tk('Other expense')];
const PAGE = 15;

function AddTransactionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const { products, customers, addTransaction, addCustomer } = useStore();
  const [type, setType] = useState<'inflow' | 'outflow'>('inflow');
  const [category, setCategory] = useState('Product sale');
  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const [quantity, setQuantity] = useState(1);
  const [amount, setAmount] = useState(0);
  const [customerId, setCustomerId] = useState('');
  const [newCustomer, setNewCustomer] = useState('');
  const [date, setDate] = useState(toISO(startOfToday()));
  const [touched, setTouched] = useState(false);

  const isSale = type === 'inflow' && category === 'Product sale';
  const product = products.find((p) => p.id === productId);
  useEffect(() => {
    if (isSale && product) setAmount(+(product.price * quantity).toFixed(2));
  }, [isSale, product, quantity]);
  useEffect(() => {
    setCategory(type === 'inflow' ? 'Product sale' : 'Materials');
  }, [type]);
  useEffect(() => {
    if (open) {
      setTouched(false);
      setQuantity(1);
      setNewCustomer('');
    }
  }, [open]);

  const err = amount <= 0 ? t('Amount must be greater than 0') : isSale && !productId ? t('Select a product') : isSale && product && quantity > product.stockOnHand ? t('Only {n} in stock', { n: product.stockOnHand }) : null;

  const submit = () => {
    setTouched(true);
    if (err) return;
    let cid = customerId || undefined;
    if (customerId === '__new' && newCustomer.trim()) cid = addCustomer({ name: newCustomer.trim(), email: `${newCustomer.trim().toLowerCase().replace(/\s+/g, '.')}@example.com`, city: '—' });
    else if (customerId === '__new') cid = undefined;
    const txn: Omit<Transaction, 'id'> = { type, category, amount, date, ...(isSale ? { productId, quantity, customerId: cid } : {}) };
    addTransaction(txn);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('Log transaction')}
      sub={t('Sales linked to a product update circularity and stock automatically')}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            {t('Cancel')}
          </button>
          <button className="btn-primary" onClick={submit}>
            {t('Save transaction')}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Segmented
          value={type}
          onChange={setType}
          options={[
            { value: 'inflow', label: t('Money in') },
            { value: 'outflow', label: t('Money out') },
          ]}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('Category')}>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {(type === 'inflow' ? INFLOW_CATS : OUTFLOW_CATS).map((c) => (
                <option key={c} value={c}>
                  {t(c)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('Date')}>
            <input type="date" className="input" value={date} max={toISO(startOfToday())} onChange={(e) => setDate(e.target.value)} />
          </Field>
          {isSale && (
            <>
              <Field label={t('Product')} className="sm:col-span-2">
                <select className="input" value={productId} onChange={(e) => setProductId(e.target.value)}>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {fmtMoney2(p.price)} · {t('{n} in stock', { n: p.stockOnHand })}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('Quantity')} error={touched && product && quantity > product.stockOnHand ? t('Only {n} in stock', { n: product.stockOnHand }) : null}>
                <input type="number" min={1} className="input" value={quantity} onChange={(e) => setQuantity(Math.max(1, +e.target.value))} />
              </Field>
              <Field label={t('Customer')}>
                <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">{t('Walk-in / anonymous')}</option>
                  <option value="__new">+ {t('New customer…')}</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              {customerId === '__new' && (
                <Field label={t('New customer name')} className="sm:col-span-2">
                  <input className="input" value={newCustomer} onChange={(e) => setNewCustomer(e.target.value)} placeholder={t('Full name')} />
                </Field>
              )}
            </>
          )}
          <Field label={t('Amount ($)')} error={touched && amount <= 0 ? t('Amount must be greater than 0') : null} hint={isSale ? t('Auto-filled from price × quantity') : undefined} className="sm:col-span-2">
            <input type="number" min={0} step="0.01" className={clsx('input', touched && amount <= 0 && 'input-error')} value={amount || ''} onChange={(e) => setAmount(+e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

export default function Transactions() {
  const t = useT();
  const { transactions, products, customers, ledger } = useStore();
  const [params, setParams] = useSearchParams();
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [type, setType] = useState<'all' | 'inflow' | 'outflow'>('all');
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const ready = useSimulatedLoad('transactions');

  useEffect(() => {
    const n = params.get('new');
    if (n === 'txn' || n === 'import') {
      if (n === 'txn') setAdding(true);
      else setImporting(true);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const productName = useMemo(() => new Map(products.map((p) => [p.id, p.name])), [products]);
  const customerName = useMemo(() => new Map(customers.map((c) => [c.id, c.name])), [customers]);
  const cats = useMemo(() => ['All', ...new Set(transactions.map((x) => x.category))], [transactions]);

  const rows = useMemo(() => {
    const s = q.toLowerCase();
    return transactions
      .filter((x) => (type === 'all' || x.type === type) && (cat === 'All' || x.category === cat))
      .filter((x) => !s || `${x.category} ${tr(x.category)} ${x.note ?? ''} ${x.productId ? productName.get(x.productId) : ''} ${x.customerId ? customerName.get(x.customerId) : ''}`.toLowerCase().includes(s))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }, [transactions, type, cat, q, productName, customerName]);
  useEffect(() => setPage(0), [type, cat, q]);

  const t30 = totalsFor(ledger, lastNDays(30));
  const in30 = transactions.filter((x) => x.type === 'inflow' && x.date >= toISO(lastNDays(30).from)).reduce((s, x) => s + x.amount, 0);
  const out30 = transactions.filter((x) => x.type === 'outflow' && x.date >= toISO(lastNDays(30).from)).reduce((s, x) => s + x.amount, 0);
  const linked = transactions.filter((x) => x.type === 'inflow' && x.category === 'Product sale');
  const linkedPct = linked.length ? (linked.filter((x) => x.productId).length / linked.length) * 100 : 0;

  const exportCsv = () => {
    const header = 'id,date,type,category,amount,product,quantity,customer\n';
    const body = rows.map((x) => [x.id, x.date, x.type, x.category, x.amount, x.productId ? productName.get(x.productId) : '', x.quantity ?? '', x.customerId ? customerName.get(x.customerId) : ''].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([header + body], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tokuma-transactions.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const slice = rows.slice(page * PAGE, page * PAGE + PAGE);

  return (
    <>
      <PageHeader
        title={t('Transactions')}
        sub={t('Every sale is linked to a product and customer, powering circularity and customer insights')}
        actions={
          <>
            {!IS_EMBEDDED && (
              <button className="btn-secondary" onClick={exportCsv}>
                <Download className="h-4 w-4" /> {t('Export CSV')}
              </button>
            )}
            <button className="btn-secondary" onClick={() => setImporting(true)}>
              <Upload className="h-4 w-4" /> {t('Import CSV / Excel')}
            </button>
            <button className="btn-primary" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" /> {t('Log transaction')}
            </button>
          </>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: t('Money in (30d)'), value: fmtMoney(in30), icon: ArrowDownLeft },
          { label: t('Money out (30d)'), value: fmtMoney(out30), icon: ArrowUpRight },
          { label: t('Net profit (30d, accrual)'), value: fmtMoney(t30.profit), icon: Receipt },
          { label: t('Sales linked to products'), value: fmtPct(linkedPct, 0), icon: Link2 },
        ].map((k) => (
          <Card key={k.label} className="p-4">
            <p className="muted flex items-center gap-1.5 text-xs">
              <k.icon className="h-3.5 w-3.5" /> {k.label}
            </p>
            <p className="num mt-1 text-2xl">{k.value}</p>
          </Card>
        ))}
      </div>
      {!ready ? (
        <TableSkeleton rows={10} cols={6} />
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 px-5 py-4">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input className="input ps-9" placeholder={t('Search product, customer, note…')} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Segmented value={type} onChange={setType} options={[{ value: 'all', label: t('All') }, { value: 'inflow', label: t('In') }, { value: 'outflow', label: t('Out') }]} />
            <select className="input w-auto" value={cat} onChange={(e) => setCat(e.target.value)}>
              {cats.map((c) => (
                <option key={c} value={c}>
                  {t(c)}
                </option>
              ))}
            </select>
            <span className="muted ms-auto text-xs tabular-nums">{t('{count} transactions', { count: rows.length })}</span>
          </div>
          {rows.length === 0 ? (
            <EmptyState
              icon={<Receipt className="h-6 w-6" />}
              title={transactions.length ? t('No transactions match') : t('No transactions yet')}
              body={transactions.length ? t('Adjust the filters or log a new transaction.') : t('Log sales and expenses one at a time, or import them from a CSV or Excel file.')}
              action={
                <div className="flex gap-2">
                  <button className="btn-secondary btn-sm" onClick={() => setImporting(true)}>
                    <Upload className="h-3.5 w-3.5" /> {t('Import file')}
                  </button>
                  <button className="btn-primary btn-sm" onClick={() => setAdding(true)}>
                    {t('Log transaction')}
                  </button>
                </div>
              }
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50/60 dark:bg-white/[0.02]">
                    <tr>
                      <th className="th">{t('Date')}</th>
                      <th className="th">{t('Description')}</th>
                      <th className="th">{t('Category')}</th>
                      <th className="th">{t('Customer')}</th>
                      <th className="th text-end">{t('Amount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slice.map((x) => (
                      <tr key={x.id} className="tr">
                        <td className="td text-gray-500">{fmtDate(x.date)}</td>
                        <td className="td">
                          <div className="flex items-center gap-2.5">
                            <span className={clsx('flex h-7 w-7 items-center justify-center rounded-lg', x.type === 'inflow' ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300' : 'bg-gray-100 text-gray-500 dark:bg-white/5')}>
                              {x.type === 'inflow' ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                            </span>
                            <span>
                              <span className="font-medium">{x.productId ? productName.get(x.productId) ?? t('Archived product') : x.note ?? t(x.category)}</span>
                              {x.quantity && <span className="muted"> × {x.quantity}</span>}
                            </span>
                          </div>
                        </td>
                        <td className="td">
                          <Badge tone={x.type === 'inflow' ? 'green' : 'gray'}>{t(x.category)}</Badge>
                        </td>
                        <td className="td text-gray-600 dark:text-gray-300">{x.customerId ? customerName.get(x.customerId) : <span className="text-gray-400">—</span>}</td>
                        <td className={clsx('td text-end font-semibold tabular-nums', x.type === 'inflow' && 'text-brand-700 dark:text-brand-400')}>
                          <span dir="ltr">
                            {x.type === 'inflow' ? '+' : '−'}
                            {fmtMoney2(x.amount)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3 text-sm dark:border-white/5">
                <span className="muted text-xs tabular-nums">
                  {t('{from}–{to} of {total}', { from: page * PAGE + 1, to: Math.min(rows.length, (page + 1) * PAGE), total: fmtInt(rows.length) })}
                </span>
                <div className="flex items-center gap-1">
                  <button className="icon-btn h-8 w-8" disabled={page === 0} onClick={() => setPage((p) => p - 1)} aria-label={t('Previous page')}>
                    <ChevronLeft className="h-4 w-4 rtl:-scale-x-100" />
                  </button>
                  <span className="px-2 text-xs tabular-nums">
                    {page + 1} / {pages}
                  </span>
                  <button className="icon-btn h-8 w-8" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} aria-label={t('Next page')}>
                    <ChevronRight className="h-4 w-4 rtl:-scale-x-100" />
                  </button>
                </div>
              </div>
            </>
          )}
        </Card>
      )}
      <AddTransactionModal open={adding} onClose={() => setAdding(false)} />
      <ImportModal open={importing} onClose={() => setImporting(false)} />
    </>
  );
}
