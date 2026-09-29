import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Download, Link2, Plus, Receipt, Search } from 'lucide-react';
import { useStore } from '../store/AppStore';
import { IS_EMBEDDED } from '../env';
import { useSimulatedLoad } from '../lib/hooks';
import { fmtDate, fmtMoney, fmtMoney2, startOfToday, toISO } from '../lib/format';
import { lastNDays, totalsFor } from '../lib/metrics';
import { Badge, Card, EmptyState, Field, Modal, PageHeader, Segmented, TableSkeleton } from '../components/ui';
import type { Transaction } from '../types';

const INFLOW_CATS = ['Product sale', 'Grant', 'Loan', 'Repair service', 'Other income'];
const OUTFLOW_CATS = ['Materials', 'Logistics', 'Payroll', 'Rent & utilities', 'Marketing', 'Packaging', 'Inventory purchase', 'Other expense'];
const PAGE = 15;

function AddTransactionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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

  const err = amount <= 0 ? 'Amount must be greater than 0' : isSale && !productId ? 'Select a product' : isSale && product && quantity > product.stockOnHand ? `Only ${product.stockOnHand} in stock` : null;

  const submit = () => {
    setTouched(true);
    if (err) return;
    let cid = customerId || undefined;
    if (customerId === '__new' && newCustomer.trim()) cid = addCustomer({ name: newCustomer.trim(), email: `${newCustomer.trim().toLowerCase().replace(/\s+/g, '.')}@example.com`, city: '—' });
    else if (customerId === '__new') cid = undefined;
    const t: Omit<Transaction, 'id'> = { type, category, amount, date, ...(isSale ? { productId, quantity, customerId: cid } : {}) };
    addTransaction(t);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Log transaction"
      sub="Sales linked to a product update circularity and stock automatically"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={submit}>
            Save transaction
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Segmented
          value={type}
          onChange={setType}
          options={[
            { value: 'inflow', label: 'Money in' },
            { value: 'outflow', label: 'Money out' },
          ]}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category">
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {(type === 'inflow' ? INFLOW_CATS : OUTFLOW_CATS).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Date">
            <input type="date" className="input" value={date} max={toISO(startOfToday())} onChange={(e) => setDate(e.target.value)} />
          </Field>
          {isSale && (
            <>
              <Field label="Product" className="sm:col-span-2">
                <select className="input" value={productId} onChange={(e) => setProductId(e.target.value)}>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {fmtMoney2(p.price)} · {p.stockOnHand} in stock
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Quantity" error={touched && product && quantity > product.stockOnHand ? `Only ${product.stockOnHand} in stock` : null}>
                <input type="number" min={1} className="input" value={quantity} onChange={(e) => setQuantity(Math.max(1, +e.target.value))} />
              </Field>
              <Field label="Customer">
                <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">Walk-in / anonymous</option>
                  <option value="__new">+ New customer…</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              {customerId === '__new' && (
                <Field label="New customer name" className="sm:col-span-2">
                  <input className="input" value={newCustomer} onChange={(e) => setNewCustomer(e.target.value)} placeholder="Full name" />
                </Field>
              )}
            </>
          )}
          <Field label="Amount ($)" error={touched && amount <= 0 ? 'Amount must be greater than 0' : null} hint={isSale ? 'Auto-filled from price × quantity' : undefined} className="sm:col-span-2">
            <input type="number" min={0} step="0.01" className={clsx('input', touched && amount <= 0 && 'input-error')} value={amount || ''} onChange={(e) => setAmount(+e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

export default function Transactions() {
  const { transactions, products, customers, ledger } = useStore();
  const [params, setParams] = useSearchParams();
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState<'all' | 'inflow' | 'outflow'>('all');
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const ready = useSimulatedLoad('transactions');

  useEffect(() => {
    if (params.get('new') === 'txn') {
      setAdding(true);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const productName = useMemo(() => new Map(products.map((p) => [p.id, p.name])), [products]);
  const customerName = useMemo(() => new Map(customers.map((c) => [c.id, c.name])), [customers]);
  const cats = useMemo(() => ['All', ...new Set(transactions.map((t) => t.category))], [transactions]);

  const rows = useMemo(() => {
    const s = q.toLowerCase();
    return transactions
      .filter((t) => (type === 'all' || t.type === type) && (cat === 'All' || t.category === cat))
      .filter((t) => !s || `${t.category} ${t.note ?? ''} ${t.productId ? productName.get(t.productId) : ''} ${t.customerId ? customerName.get(t.customerId) : ''}`.toLowerCase().includes(s))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }, [transactions, type, cat, q, productName, customerName]);
  useEffect(() => setPage(0), [type, cat, q]);

  const t30 = totalsFor(ledger, lastNDays(30));
  const in30 = transactions.filter((t) => t.type === 'inflow' && t.date >= toISO(lastNDays(30).from)).reduce((s, t) => s + t.amount, 0);
  const out30 = transactions.filter((t) => t.type === 'outflow' && t.date >= toISO(lastNDays(30).from)).reduce((s, t) => s + t.amount, 0);
  const linked = transactions.filter((t) => t.type === 'inflow' && t.category === 'Product sale');
  const linkedPct = linked.length ? (linked.filter((t) => t.productId).length / linked.length) * 100 : 0;

  const exportCsv = () => {
    const header = 'id,date,type,category,amount,product,quantity,customer\n';
    const body = rows.map((t) => [t.id, t.date, t.type, t.category, t.amount, t.productId ? productName.get(t.productId) : '', t.quantity ?? '', t.customerId ? customerName.get(t.customerId) : ''].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
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
        title="Transactions"
        sub="Every sale is linked to a product and customer, powering circularity and customer insights"
        actions={
          <>
            {!IS_EMBEDDED && (
              <button className="btn-secondary" onClick={exportCsv}>
                <Download className="h-4 w-4" /> Export CSV
              </button>
            )}
            <button className="btn-primary" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" /> Log transaction
            </button>
          </>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Money in (30d)', value: fmtMoney(in30), icon: ArrowDownLeft },
          { label: 'Money out (30d)', value: fmtMoney(out30), icon: ArrowUpRight },
          { label: 'Net profit (30d, accrual)', value: fmtMoney(t30.profit), icon: Receipt },
          { label: 'Sales linked to products', value: `${linkedPct.toFixed(0)}%`, icon: Link2 },
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
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input className="input pl-9" placeholder="Search product, customer, note…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Segmented value={type} onChange={setType} options={[{ value: 'all', label: 'All' }, { value: 'inflow', label: 'In' }, { value: 'outflow', label: 'Out' }]} />
            <select className="input w-auto" value={cat} onChange={(e) => setCat(e.target.value)}>
              {cats.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <span className="muted ml-auto text-xs tabular-nums">{rows.length.toLocaleString()} transactions</span>
          </div>
          {rows.length === 0 ? (
            <EmptyState icon={<Receipt className="h-6 w-6" />} title="No transactions match" body="Adjust the filters or log a new transaction." action={<button className="btn-primary btn-sm" onClick={() => setAdding(true)}>Log transaction</button>} />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50/60 dark:bg-white/[0.02]">
                    <tr>
                      <th className="th">Date</th>
                      <th className="th">Description</th>
                      <th className="th">Category</th>
                      <th className="th">Customer</th>
                      <th className="th text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slice.map((t) => (
                      <tr key={t.id} className="tr">
                        <td className="td text-gray-500">{fmtDate(t.date)}</td>
                        <td className="td">
                          <div className="flex items-center gap-2.5">
                            <span className={clsx('flex h-7 w-7 items-center justify-center rounded-lg', t.type === 'inflow' ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300' : 'bg-gray-100 text-gray-500 dark:bg-white/5')}>
                              {t.type === 'inflow' ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                            </span>
                            <span>
                              <span className="font-medium">{t.productId ? productName.get(t.productId) ?? 'Archived product' : t.note ?? t.category}</span>
                              {t.quantity && <span className="muted"> × {t.quantity}</span>}
                            </span>
                          </div>
                        </td>
                        <td className="td">
                          <Badge tone={t.type === 'inflow' ? 'green' : 'gray'}>{t.category}</Badge>
                        </td>
                        <td className="td text-gray-600 dark:text-gray-300">{t.customerId ? customerName.get(t.customerId) : <span className="text-gray-400">—</span>}</td>
                        <td className={clsx('td text-right font-semibold tabular-nums', t.type === 'inflow' && 'text-brand-700 dark:text-brand-400')}>
                          {t.type === 'inflow' ? '+' : '−'}
                          {fmtMoney2(t.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3 text-sm dark:border-white/5">
                <span className="muted text-xs tabular-nums">
                  {page * PAGE + 1}–{Math.min(rows.length, (page + 1) * PAGE)} of {rows.length.toLocaleString()}
                </span>
                <div className="flex items-center gap-1">
                  <button className="icon-btn h-8 w-8" disabled={page === 0} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="px-2 text-xs tabular-nums">
                    {page + 1} / {pages}
                  </span>
                  <button className="icon-btn h-8 w-8" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </Card>
      )}
      <AddTransactionModal open={adding} onClose={() => setAdding(false)} />
    </>
  );
}
