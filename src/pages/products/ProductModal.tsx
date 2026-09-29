import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { avgDailySales, classifyMaterial, materialCircularity, reorderPoint } from '../../lib/metrics';
import { Field, Modal, Ring, StockBar } from '../../components/ui';
import type { MaterialClass, Product } from '../../types';

// Form state keeps "not entered yet" (null / '') separate from real values, so
// nothing is pre-filled and no number is shown until the owner types it.
interface DraftMaterial {
  name: string;
  weightKg: number | null;
  type: MaterialClass | '';
}
interface Draft {
  id?: string;
  name: string;
  sku: string;
  category: string;
  price: number | null;
  unitCost: number | null;
  materials: DraftMaterial[];
  stockOnHand: number | null;
  lowStockThreshold: number | null;
  safetyStock: number | null;
  supplierId?: string;
}

const blankMaterial = (): DraftMaterial => ({ name: '', weightKg: null, type: '' });
const empty = (): Draft => ({
  name: '',
  sku: '',
  category: '',
  price: null,
  unitCost: null,
  materials: [blankMaterial()],
  stockOnHand: null,
  lowStockThreshold: null,
  safetyStock: null,
  supplierId: undefined,
});
const toDraft = (p: Product): Draft => ({
  ...p,
  materials: p.materials.map((m) => ({ name: m.name, weightKg: m.weightKg, type: classifyMaterial(m) })),
});
const num = (v: string) => (v.trim() === '' ? null : Number(v));

const CATEGORIES = ['Tops', 'Outerwear', 'Bottoms', 'Accessories', 'Home', 'Other'];

export function ProductModal({ open, onClose, product }: { open: boolean; onClose: () => void; product?: Product | null }) {
  const { suppliers, addProduct, updateProduct, deleteProduct, ledger } = useStore();
  const [d, setD] = useState<Draft>(empty);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (open) {
      setD(product ? toDraft(product) : empty());
      setTouched({});
    }
  }, [open, product]);

  const errors = useMemo(() => {
    const e: Record<string, string | null> = {};
    e.name = d.name.trim().length < 2 ? 'Give the product a name' : null;
    e.price = d.price === null || d.price <= 0 ? 'Enter the selling price' : null;
    e.unitCost = d.unitCost === null ? 'Enter what one unit costs you to make or buy' : d.unitCost < 0 ? 'Cost cannot be negative' : d.price && d.unitCost >= d.price ? 'Unit cost is above price — negative margin' : null;
    e.stockOnHand = d.stockOnHand === null ? 'Enter how many you have in stock (0 if none)' : d.stockOnHand < 0 ? 'Cannot be negative' : null;
    e.lowStockThreshold = d.lowStockThreshold !== null && d.lowStockThreshold < 0 ? 'Cannot be negative' : null;
    e.materials =
      d.materials.length === 0
        ? 'Add at least one material'
        : d.materials.some((m) => !m.name.trim() || !m.weightKg || m.weightKg <= 0)
          ? 'Each material needs a name and a weight'
          : d.materials.some((m) => !m.type)
            ? 'Choose recycled, reused or virgin for each material'
            : null;
    return e;
  }, [d]);
  const valid = Object.values(errors).every((v) => !v || v.includes('negative margin'));
  const show = (k: string) => (touched[k] ? errors[k] : null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setD((x) => ({ ...x, [k]: v }));
    setTouched((t) => ({ ...t, [k]: true }));
  };
  const setMat = (i: number, m: Partial<DraftMaterial>) => {
    setD((x) => ({ ...x, materials: x.materials.map((mm, j) => (j === i ? { ...mm, ...m } : mm)) }));
    setTouched((t) => ({ ...t, materials: true }));
  };

  const supplier = suppliers.find((s) => s.id === d.supplierId);
  const lead = supplier?.avgLeadTimeDays ?? null;
  const avg = d.id ? avgDailySales(ledger, d.id) : 0;
  const rop = lead === null ? null : reorderPoint(avg, lead, d.safetyStock ?? 0);
  // Score only once every material has a weight and a type the owner chose.
  const materialsComplete = d.materials.length > 0 && d.materials.every((m) => m.name.trim() && m.weightKg && m.type);
  const score = materialsComplete
    ? materialCircularity(d.materials.map((m) => ({ name: m.name, weightKg: m.weightKg!, recycled: m.type === 'Recycled', reused: m.type === 'Reused' })))
    : null;
  const margin = d.price && d.unitCost !== null ? ((d.price - d.unitCost) / d.price) * 100 : null;

  const save = () => {
    setTouched({ name: true, price: true, unitCost: true, materials: true, stockOnHand: true, lowStockThreshold: true });
    if (!valid) return;
    const { id, ...rest } = d;
    const out = {
      ...rest,
      category: rest.category || 'Uncategorized',
      price: rest.price!,
      unitCost: rest.unitCost!,
      stockOnHand: rest.stockOnHand!,
      // Blank means "no alert" / "no buffer" — the owner didn't set one.
      lowStockThreshold: rest.lowStockThreshold ?? 0,
      safetyStock: rest.safetyStock ?? 0,
      materials: rest.materials.map((m) => ({ name: m.name.trim(), weightKg: m.weightKg!, recycled: m.type === 'Recycled', reused: m.type === 'Reused' })),
    };
    if (id && product) updateProduct({ ...product, ...out, id });
    else addProduct(out);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={product ? `Edit ${product.name}` : 'Add product'}
      sub={product ? product.sku : 'Materials drive your circularity score automatically'}
      footer={
        <>
          {product && (
            <button
              className="btn-ghost mr-auto text-red-600 dark:text-red-400"
              onClick={() => {
                deleteProduct(product.id);
                onClose();
              }}
            >
              <Trash2 className="h-4 w-4" /> Archive
            </button>
          )}
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save}>
            {product ? 'Save changes' : 'Add product'}
          </button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Product name" error={show('name')} className="sm:col-span-2">
              <input className={`input ${show('name') ? 'input-error' : ''}`} value={d.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Organic Cotton T-Shirt" />
            </Field>
            <Field label="SKU">
              <input className="input" value={d.sku} onChange={(e) => set('sku', e.target.value)} placeholder="TKM-XX-000" />
            </Field>
            <Field label="Category">
              <select className="input" value={d.category} onChange={(e) => set('category', e.target.value)}>
                <option value="">Select a category (optional)</option>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Price ($)" error={show('price')}>
              <input type="number" min={0} step="0.01" className={`input ${show('price') ? 'input-error' : ''}`} value={d.price ?? ''} onChange={(e) => set('price', num(e.target.value))} />
            </Field>
            <Field label="Unit cost ($)" error={show('unitCost')} hint={margin !== null ? `${margin.toFixed(0)}% gross margin` : undefined}>
              <input type="number" min={0} step="0.01" className={`input ${show('unitCost') ? 'input-error' : ''}`} value={d.unitCost ?? ''} onChange={(e) => set('unitCost', num(e.target.value))} />
            </Field>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="label mb-0">Bill of materials</span>
              <button className="btn-ghost btn-sm" onClick={() => setD((x) => ({ ...x, materials: [...x.materials, blankMaterial()] }))}>
                <Plus className="h-3.5 w-3.5" /> Add material
              </button>
            </div>
            <div className="space-y-2">
              {d.materials.map((m, i) => (
                <div key={i} className="grid grid-cols-[1fr_90px_120px_32px] items-center gap-2">
                  <input className="input" placeholder="Material name" value={m.name} onChange={(e) => setMat(i, { name: e.target.value })} />
                  <div className="relative">
                    <input type="number" step="0.01" min={0} className="input pr-8" placeholder="0.00" value={m.weightKg ?? ''} onChange={(e) => setMat(i, { weightKg: num(e.target.value) })} />
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">kg</span>
                  </div>
                  <select className="input" value={m.type} onChange={(e) => setMat(i, { type: e.target.value as MaterialClass | '' })} aria-label="Material type">
                    <option value="">Type…</option>
                    <option>Recycled</option>
                    <option>Reused</option>
                    <option>Virgin</option>
                  </select>
                  <button className="icon-btn h-8 w-8" onClick={() => setD((x) => ({ ...x, materials: x.materials.filter((_, j) => j !== i) }))} aria-label="Remove material">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            {show('materials') && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{errors.materials}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Supplier"
              hint={supplier ? (lead !== null ? `Lead time ${lead} days (from this supplier)` : 'This supplier has no lead time yet — add one to get a reorder point') : 'Link a supplier with a lead time to get a reorder point'}
              className="sm:col-span-2"
            >
              <select className="input" value={d.supplierId ?? ''} onChange={(e) => set('supplierId', e.target.value || undefined)}>
                <option value="">— None —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.avgLeadTimeDays !== null ? ` · ${s.avgLeadTimeDays}d lead` : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Stock on hand" error={show('stockOnHand')}>
              <input type="number" min={0} className={`input ${show('stockOnHand') ? 'input-error' : ''}`} placeholder="Units in stock" value={d.stockOnHand ?? ''} onChange={(e) => set('stockOnHand', num(e.target.value))} />
            </Field>
            <Field label="Low-stock threshold" error={show('lowStockThreshold')} hint="Optional — alert me at or below this many">
              <input type="number" min={0} className="input" placeholder="Optional" value={d.lowStockThreshold ?? ''} onChange={(e) => set('lowStockThreshold', num(e.target.value))} />
            </Field>
            <Field label="Safety stock" hint="Optional — extra buffer added to the reorder point">
              <input type="number" min={0} className="input" placeholder="Optional" value={d.safetyStock ?? ''} onChange={(e) => set('safetyStock', num(e.target.value))} />
            </Field>
          </div>
        </div>

        <aside className="space-y-4 rounded-xl bg-gray-50 p-4 dark:bg-white/[0.03]">
          <div className="flex items-center gap-3">
            {score === null ? (
              <span className="flex h-14 w-14 items-center justify-center rounded-full border-[6px] border-gray-200 text-sm font-semibold text-gray-400 dark:border-white/10">—</span>
            ) : (
              <Ring value={score} size={56} stroke={6} />
            )}
            <div>
              <p className="text-sm font-semibold">Circularity score</p>
              <p className="muted text-xs">{score === null ? 'Fill in each material’s weight and type to calculate' : 'Share of weight from recycled/reused inputs'}</p>
            </div>
          </div>
          <div className="border-t border-gray-200 pt-4 dark:border-white/10">
            <p className="text-sm font-semibold">Reorder point</p>
            {rop === null ? (
              <p className="muted mt-1 text-xs leading-relaxed">Needs a linked supplier with a lead time.</p>
            ) : (
              <>
                <p className="num mt-1 text-2xl">{rop} units</p>
                <p className="muted mt-1 text-xs leading-relaxed">
                  ({avg.toFixed(2)}/day sold × {lead}d lead) + {d.safetyStock ?? 0} safety
                  {avg === 0 && ' — no sales logged yet'}
                </p>
              </>
            )}
            {d.stockOnHand !== null && (
              <div className="mt-3">
                <StockBar stock={d.stockOnHand} threshold={d.lowStockThreshold ?? 0} reorderPoint={rop} />
              </div>
            )}
          </div>
        </aside>
      </div>
    </Modal>
  );
}
