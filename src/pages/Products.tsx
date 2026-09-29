import { useEffect, useMemo, useState } from 'react';
import { NavLink, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { AlertTriangle, ArrowUpDown, Boxes, Calculator, LayoutGrid, List, PackagePlus, Plus, Search, Truck } from 'lucide-react';
import { useStore } from '../store/AppStore';
import { useSimulatedLoad } from '../lib/hooks';
import { fmtMoney, fmtMoney2 } from '../lib/format';
import { classifyMaterial, type InventoryRow } from '../lib/metrics';
import { Badge, Card, CardSkeleton, EmptyState, Field, Modal, PageHeader, Ring, Segmented, StatusBadge, StockBar, TableSkeleton, Tip } from '../components/ui';
import { ProductModal } from './products/ProductModal';
import type { Product } from '../types';

function ProductTabs() {
  const cls = ({ isActive }: { isActive: boolean }) =>
    clsx('-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition', isActive ? 'border-brand-600 text-gray-900 dark:border-brand-400 dark:text-white' : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200');
  return (
    <div className="mt-5 flex gap-1 border-b border-gray-200 dark:border-white/10">
      <NavLink to="/app/products" end className={cls}>
        Catalog
      </NavLink>
      <NavLink to="/app/products/inventory" className={cls}>
        Inventory
      </NavLink>
    </div>
  );
}

const matTone = { Recycled: 'green', Reused: 'blue', Virgin: 'gray' } as const;

function ProductCard({ r, onOpen }: { r: InventoryRow; onOpen: () => void }) {
  const p = r.product;
  const margin = ((p.price - p.unitCost) / p.price) * 100;
  return (
    <Card hover className="group flex cursor-pointer flex-col p-5 transition hover:-translate-y-0.5" onClick={onOpen}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{p.name}</p>
          <p className="muted text-xs">
            {p.sku} · {p.category}
          </p>
        </div>
        <Tip content="Circularity score — share of weight from recycled or reused material">
          <Ring value={p.circularityScore} />
        </Tip>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
        <div>
          <p className="muted text-[11px]">Price</p>
          <p className="num">{fmtMoney2(p.price)}</p>
        </div>
        <div>
          <p className="muted text-[11px]">Unit cost</p>
          <p className="num">{fmtMoney2(p.unitCost)}</p>
        </div>
        <div>
          <p className="muted text-[11px]">Margin</p>
          <p className="num">{margin.toFixed(0)}%</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {p.materials.map((m) => (
          <Badge key={m.name} tone={matTone[classifyMaterial(m)]}>
            {m.name} · {m.weightKg}kg
          </Badge>
        ))}
      </div>
      <div className="mt-auto pt-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="muted text-xs">Stock level</span>
          <StatusBadge status={r.status} />
        </div>
        <StockBar stock={p.stockOnHand} threshold={p.lowStockThreshold} reorderPoint={r.reorderPoint} />
      </div>
    </Card>
  );
}

type SortKey = 'name' | 'price' | 'circularityScore' | 'stockOnHand' | 'margin';

function Catalog({ onOpen }: { onOpen: (p: Product) => void }) {
  const { inventory } = useStore();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [view, setView] = useState<'grid' | 'table'>(() => {
    try {
      return (localStorage.getItem('tokuma-products-view') as 'grid' | 'table') || 'grid';
    } catch {
      return 'grid';
    }
  });
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'name', dir: 1 });
  useEffect(() => {
    try {
      localStorage.setItem('tokuma-products-view', view);
    } catch {
      /* ignore */
    }
  }, [view]);

  const cats = ['All', ...new Set(inventory.map((r) => r.product.category))];
  const rows = inventory
    .filter((r) => (cat === 'All' || r.product.category === cat) && `${r.product.name} ${r.product.sku}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => {
      const va = sort.key === 'margin' ? (a.product.price - a.product.unitCost) / a.product.price : a.product[sort.key];
      const vb = sort.key === 'margin' ? (b.product.price - b.product.unitCost) / b.product.price : b.product[sort.key];
      return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
    });
  const th = (k: SortKey, label: string, right?: boolean) => (
    <th className={clsx('th', right && 'text-right')}>
      <button className={clsx('inline-flex items-center gap-1 hover:text-gray-900 dark:hover:text-white', sort.key === k && 'text-gray-900 dark:text-white')} onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? (-s.dir as 1 | -1) : 1 }))}>
        {label}
        <ArrowUpDown className="h-3 w-3" />
      </button>
    </th>
  );

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search by name or SKU" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Segmented value={cat} onChange={setCat} options={cats.map((c) => ({ value: c, label: c }))} />
        <Segmented
          className="ml-auto"
          value={view}
          onChange={setView}
          options={[
            { value: 'grid', label: <LayoutGrid className="h-4 w-4" aria-label="Grid view" /> },
            { value: 'table', label: <List className="h-4 w-4" aria-label="Table view" /> },
          ]}
        />
      </div>
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={<Search className="h-6 w-6" />} title="No products match" body="Try a different search term or category." action={<button className="btn-secondary btn-sm" onClick={() => { setQ(''); setCat('All'); }}>Clear filters</button>} />
        </Card>
      ) : view === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <ProductCard key={r.product.id} r={r} onOpen={() => onOpen(r.product)} />
          ))}
        </div>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50/60 dark:bg-white/[0.02]">
              <tr>
                {th('name', 'Product')}
                <th className="th">Materials</th>
                {th('price', 'Price', true)}
                {th('margin', 'Margin', true)}
                {th('circularityScore', 'Circularity', true)}
                {th('stockOnHand', 'Stock')}
                <th className="th text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const p = r.product;
                return (
                  <tr key={p.id} className="tr cursor-pointer" onClick={() => onOpen(p)}>
                    <td className="td">
                      <p className="font-medium">{p.name}</p>
                      <p className="muted text-xs">{p.sku}</p>
                    </td>
                    <td className="td">
                      <div className="flex gap-1">
                        {p.materials.map((m) => (
                          <Tip key={m.name} content={`${m.name} · ${m.weightKg}kg · ${classifyMaterial(m)}`}>
                            <span className={clsx('h-2.5 w-2.5 rounded-full', classifyMaterial(m) === 'Recycled' ? 'bg-brand-600' : classifyMaterial(m) === 'Reused' ? 'bg-brand-300' : 'bg-gray-300 dark:bg-gray-600')} />
                          </Tip>
                        ))}
                      </div>
                    </td>
                    <td className="td text-right tabular-nums">{fmtMoney2(p.price)}</td>
                    <td className="td text-right tabular-nums">{(((p.price - p.unitCost) / p.price) * 100).toFixed(0)}%</td>
                    <td className="td text-right font-semibold tabular-nums">{p.circularityScore}%</td>
                    <td className="td w-56">
                      <StockBar stock={p.stockOnHand} threshold={p.lowStockThreshold} reorderPoint={r.reorderPoint} compact />
                    </td>
                    <td className="td text-right">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}

function Inventory({ onOpen }: { onOpen: (p: Product) => void }) {
  const { inventory, restock } = useStore();
  const [restocking, setRestocking] = useState<InventoryRow | null>(null);
  const [qty, setQty] = useState(0);
  const [filter, setFilter] = useState<'all' | 'attention'>('all');
  const critical = inventory.filter((r) => r.status === 'critical').length;
  const reorder = inventory.filter((r) => r.status === 'reorder').length;
  const value = inventory.reduce((s, r) => s + r.product.stockOnHand * r.product.unitCost, 0);
  const units = inventory.reduce((s, r) => s + r.product.stockOnHand, 0);
  const rows = inventory
    .filter((r) => filter === 'all' || r.status !== 'healthy')
    .sort((a, b) => ({ critical: 0, reorder: 1, healthy: 2 })[a.status] - ({ critical: 0, reorder: 1, healthy: 2 })[b.status] || a.daysOfCover - b.daysOfCover);

  const tiles = [
    { label: 'Units on hand', value: units.toLocaleString(), sub: `${inventory.length} SKUs` },
    { label: 'Inventory value', value: fmtMoney(value), sub: 'at unit cost' },
    { label: 'Below threshold', value: critical, sub: 'critical — order now', tone: critical ? 'text-red-600 dark:text-red-400' : '' },
    { label: 'At reorder point', value: reorder, sub: 'order within lead time', tone: reorder ? 'text-amber-600 dark:text-amber-400' : '' },
  ];

  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} className="p-4">
            <p className="muted text-xs">{t.label}</p>
            <p className={clsx('num mt-1 text-2xl', t.tone)}>{t.value}</p>
            <p className="muted text-[11px]">{t.sub}</p>
          </Card>
        ))}
      </div>
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <h3 className="card-title">Stock levels</h3>
            <p className="card-sub flex items-center gap-1">
              <Calculator className="h-3.5 w-3.5" /> Reorder point = (avg daily sales × supplier lead time) + safety stock
            </p>
          </div>
          <Segmented value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'attention', label: `Needs attention (${critical + reorder})` }]} />
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={<Boxes className="h-6 w-6" />} title="Everything is well stocked" body="No products are at or below their reorder point." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50/60 dark:bg-white/[0.02]">
                <tr>
                  <th className="th">Product</th>
                  <th className="th min-w-[200px]">Stock vs threshold</th>
                  <th className="th text-right">Avg / day</th>
                  <th className="th text-right">Lead time</th>
                  <th className="th text-right">Safety</th>
                  <th className="th text-right">Reorder pt</th>
                  <th className="th text-right">Cover</th>
                  <th className="th">Status</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.product.id} className={clsx('tr', r.status === 'critical' && 'bg-red-50/40 dark:bg-red-500/[0.04]')}>
                    <td className="td">
                      <button className="text-left font-medium hover:text-brand-700 dark:hover:text-brand-300" onClick={() => onOpen(r.product)}>
                        {r.product.name}
                      </button>
                      <p className="muted flex items-center gap-1 text-xs">
                        <Truck className="h-3 w-3" /> {r.supplier?.name ?? 'No supplier linked'}
                      </p>
                    </td>
                    <td className="td">
                      <StockBar stock={r.product.stockOnHand} threshold={r.product.lowStockThreshold} reorderPoint={r.reorderPoint} />
                    </td>
                    <td className="td text-right tabular-nums">{r.avgDaily.toFixed(2)}</td>
                    <td className="td text-right tabular-nums">
                      <Tip content={r.supplier ? `Pulled from ${r.supplier.name}` : 'Default — link a supplier'}>
                        <span className={clsx('border-b border-dashed border-gray-300 dark:border-gray-600', !r.supplier && 'text-gray-400')}>{r.leadTime}d</span>
                      </Tip>
                    </td>
                    <td className="td text-right tabular-nums">{r.product.safetyStock}</td>
                    <td className="td text-right font-semibold tabular-nums">{r.reorderPoint}</td>
                    <td className={clsx('td text-right tabular-nums', r.daysOfCover < r.leadTime && 'font-semibold text-red-600 dark:text-red-400')}>
                      {Number.isFinite(r.daysOfCover) ? `${Math.floor(r.daysOfCover)}d` : '—'}
                    </td>
                    <td className="td">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="td text-right">
                      <button
                        className={r.status === 'healthy' ? 'btn-secondary btn-sm' : 'btn-primary btn-sm'}
                        onClick={() => {
                          setRestocking(r);
                          setQty(r.suggestedOrder || 50);
                        }}
                      >
                        <PackagePlus className="h-3.5 w-3.5" /> Restock
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={!!restocking}
        onClose={() => setRestocking(null)}
        size="sm"
        title={`Restock ${restocking?.product.name ?? ''}`}
        sub={restocking?.supplier ? `From ${restocking.supplier.name} · ~${restocking.leadTime} day lead time` : undefined}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setRestocking(null)}>
              Cancel
            </button>
            <button
              className="btn-primary"
              disabled={qty <= 0}
              onClick={() => {
                if (restocking) restock(restocking.product.id, qty);
                setRestocking(null);
              }}
            >
              Receive {qty} units
            </button>
          </>
        }
      >
        {restocking && (
          <div className="space-y-4">
            <Field label="Quantity" hint={`Suggested: ${restocking.suggestedOrder} units (covers lead time + 30 days + safety stock)`}>
              <input type="number" min={1} className="input" value={qty} onChange={(e) => setQty(Math.max(0, +e.target.value))} />
            </Field>
            <div className="rounded-lg bg-gray-50 p-3 text-sm dark:bg-white/[0.03]">
              <div className="flex justify-between">
                <span className="muted">Cost</span>
                <span className="font-semibold tabular-nums">{fmtMoney2(qty * restocking.product.unitCost)}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="muted">Stock after</span>
                <span className="font-semibold tabular-nums">{restocking.product.stockOnHand + qty} units</span>
              </div>
            </div>
            <StockBar stock={restocking.product.stockOnHand + qty} threshold={restocking.product.lowStockThreshold} reorderPoint={restocking.reorderPoint} />
          </div>
        )}
      </Modal>
    </>
  );
}

export default function Products({ view }: { view: 'catalog' | 'inventory' }) {
  const { products, inventory } = useStore();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<Product | null>(null);
  const [adding, setAdding] = useState(false);
  const ready = useSimulatedLoad(`products-${view}`);
  const attention = inventory.filter((r) => r.status !== 'healthy').length;

  useEffect(() => {
    const open = params.get('open');
    if (open) {
      const p = products.find((x) => x.id === open);
      if (p) setEditing(p);
    }
    if (params.get('new') === 'product') setAdding(true);
    if (open || params.get('new')) setParams({}, { replace: true });
  }, [params, products, setParams]);

  const current = useMemo(() => (editing ? products.find((p) => p.id === editing.id) ?? null : null), [editing, products]);

  return (
    <>
      <PageHeader
        title={view === 'catalog' ? 'Products' : 'Inventory'}
        sub={view === 'catalog' ? `${products.length} products · circularity is scored from each bill of materials` : 'Reorder points update automatically from sales velocity and supplier lead times'}
        actions={
          <>
            {attention > 0 && view === 'catalog' && (
              <NavLink to="/app/products/inventory" className="btn-secondary text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4" /> {attention} need restock
              </NavLink>
            )}
            <button className="btn-primary" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" /> Add product
            </button>
          </>
        }
      >
        <ProductTabs />
      </PageHeader>
      {!ready ? (
        view === 'catalog' ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} className="h-[280px]" lines={5} />
            ))}
          </div>
        ) : (
          <TableSkeleton rows={6} cols={7} />
        )
      ) : products.length === 0 ? (
        <Card>
          <EmptyState icon={<PackagePlus className="h-6 w-6" />} title="No products yet" body="Add your first product and its materials to start tracking circularity and stock." action={<button className="btn-primary" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add product</button>} />
        </Card>
      ) : view === 'catalog' ? (
        <Catalog onOpen={setEditing} />
      ) : (
        <Inventory onOpen={setEditing} />
      )}
      <ProductModal open={adding || !!current} product={current} onClose={() => { setAdding(false); setEditing(null); }} />
    </>
  );
}
