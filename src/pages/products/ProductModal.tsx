import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { avgDailySales, classifyMaterial, materialCircularity, reorderPoint } from '../../lib/metrics';
import { Field, Modal, Ring, StockBar } from '../../components/ui';
import type { MaterialClass, Product } from '../../types';
import { tk, useLang, useT } from '../../i18n';
import { fmtNum, fmtPct } from '../../lib/format';

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
const NEGATIVE_MARGIN = 'negative-margin';
const num = (v: string) => (v.trim() === '' ? null : Number(v));

const CATEGORIES = [tk('Tops'), tk('Outerwear'), tk('Bottoms'), tk('Accessories'), tk('Home'), tk('Other')];

export function ProductModal({ open, onClose, product }: { open: boolean; onClose: () => void; product?: Product | null }) {
  const t = useT();
  const { lang } = useLang();
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
    e.name = d.name.trim().length < 2 ? t('Give the product a name') : null;
    e.price = d.price === null || d.price <= 0 ? t('Enter the selling price') : null;
    e.unitCost = d.unitCost === null ? t('Enter what one unit costs you to make or buy') : d.unitCost < 0 ? t('Cost cannot be negative') : d.price && d.unitCost >= d.price ? NEGATIVE_MARGIN : null;
    e.stockOnHand = d.stockOnHand === null ? t('Enter how many you have in stock (0 if none)') : d.stockOnHand < 0 ? t('Cannot be negative') : null;
    e.lowStockThreshold = d.lowStockThreshold !== null && d.lowStockThreshold < 0 ? t('Cannot be negative') : null;
    e.materials =
      d.materials.length === 0
        ? t('Add at least one material')
        : d.materials.some((m) => !m.name.trim() || !m.weightKg || m.weightKg <= 0)
          ? t('Each material needs a name and a weight')
          : d.materials.some((m) => !m.type)
            ? t('Choose recycled, reused or virgin for each material')
            : null;
    return e;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- messages follow the language
  }, [d, lang]);
  // A negative margin is a warning, not a blocker.
  const valid = Object.values(errors).every((v) => !v || v === NEGATIVE_MARGIN);
  const message = (v: string | null | undefined) => (v === NEGATIVE_MARGIN ? t('Unit cost is above price — negative margin') : v);
  const show = (k: string) => (touched[k] ? message(errors[k]) : null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setD((x) => ({ ...x, [k]: v }));
    setTouched((x) => ({ ...x, [k]: true }));
  };
  const setMat = (i: number, m: Partial<DraftMaterial>) => {
    setD((x) => ({ ...x, materials: x.materials.map((mm, j) => (j === i ? { ...mm, ...m } : mm)) }));
    setTouched((x) => ({ ...x, materials: true }));
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
      title={product ? t('Edit {name}', { name: product.name }) : t('Add product')}
      sub={product ? product.sku : t('Materials drive your circularity score automatically')}
      footer={
        <>
          {product && (
            <button
              className="btn-ghost me-auto text-red-600 dark:text-red-400"
              onClick={() => {
                deleteProduct(product.id);
                onClose();
              }}
            >
              <Trash2 className="h-4 w-4" /> {t('Archive')}
            </button>
          )}
          <button className="btn-secondary" onClick={onClose}>
            {t('Cancel')}
          </button>
          <button className="btn-primary" onClick={save}>
            {product ? t('Save changes') : t('Add product')}
          </button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('Product name')} error={show('name')} className="sm:col-span-2">
              <input className={`input ${show('name') ? 'input-error' : ''}`} value={d.name} onChange={(e) => set('name', e.target.value)} placeholder={t('e.g. Organic Cotton T-Shirt')} />
            </Field>
            <Field label={t('SKU')}>
              <input className="input" value={d.sku} onChange={(e) => set('sku', e.target.value)} placeholder="TKM-XX-000" />
            </Field>
            <Field label={t('Category')}>
              <select className="input" value={d.category} onChange={(e) => set('category', e.target.value)}>
                <option value="">{t('Select a category (optional)')}</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(c)}
                  </option>
                ))}
                {d.category && !CATEGORIES.includes(d.category) && <option value={d.category}>{t(d.category)}</option>}
              </select>
            </Field>
            <Field label={t('Price ($)')} error={show('price')}>
              <input type="number" min={0} step="0.01" className={`input ${show('price') ? 'input-error' : ''}`} value={d.price ?? ''} onChange={(e) => set('price', num(e.target.value))} />
            </Field>
            <Field label={t('Unit cost ($)')} error={show('unitCost')} hint={margin !== null ? t('{pct} gross margin', { pct: fmtPct(margin, 0) }) : undefined}>
              <input type="number" min={0} step="0.01" className={`input ${show('unitCost') ? 'input-error' : ''}`} value={d.unitCost ?? ''} onChange={(e) => set('unitCost', num(e.target.value))} />
            </Field>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="label mb-0">{t('Bill of materials')}</span>
              <button className="btn-ghost btn-sm" onClick={() => setD((x) => ({ ...x, materials: [...x.materials, blankMaterial()] }))}>
                <Plus className="h-3.5 w-3.5" /> {t('Add material')}
              </button>
            </div>
            <div className="space-y-2">
              {d.materials.map((m, i) => (
                <div key={i} className="grid grid-cols-[1fr_90px_120px_32px] items-center gap-2">
                  <input className="input" placeholder={t('Material name')} value={m.name} onChange={(e) => setMat(i, { name: e.target.value })} />
                  <div className="relative">
                    <input type="number" step="0.01" min={0} className="input pe-8" placeholder="0.00" value={m.weightKg ?? ''} onChange={(e) => setMat(i, { weightKg: num(e.target.value) })} />
                    <span className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">kg</span>
                  </div>
                  <select className="input" value={m.type} onChange={(e) => setMat(i, { type: e.target.value as MaterialClass | '' })} aria-label={t('Material type')}>
                    <option value="">{t('Type…')}</option>
                    <option value="Recycled">{t('Recycled')}</option>
                    <option value="Reused">{t('Reused')}</option>
                    <option value="Virgin">{t('Virgin')}</option>
                  </select>
                  <button className="icon-btn h-8 w-8" onClick={() => setD((x) => ({ ...x, materials: x.materials.filter((_, j) => j !== i) }))} aria-label={t('Remove material')}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            {show('materials') && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{errors.materials}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t('Supplier')}
              hint={
                supplier
                  ? lead !== null
                    ? t('Lead time {count} days (from this supplier)', { count: lead })
                    : t('This supplier has no lead time yet — add one to get a reorder point')
                  : t('Link a supplier with a lead time to get a reorder point')
              }
              className="sm:col-span-2"
            >
              <select className="input" value={d.supplierId ?? ''} onChange={(e) => set('supplierId', e.target.value || undefined)}>
                <option value="">— {t('None')} —</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.avgLeadTimeDays !== null ? ` · ${t('{n}d lead', { n: s.avgLeadTimeDays })}` : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('Stock on hand')} error={show('stockOnHand')}>
              <input type="number" min={0} className={`input ${show('stockOnHand') ? 'input-error' : ''}`} placeholder={t('Units in stock')} value={d.stockOnHand ?? ''} onChange={(e) => set('stockOnHand', num(e.target.value))} />
            </Field>
            <Field label={t('Low-stock threshold')} error={show('lowStockThreshold')} hint={t('Optional — alert me at or below this many')}>
              <input type="number" min={0} className="input" placeholder={t('Optional')} value={d.lowStockThreshold ?? ''} onChange={(e) => set('lowStockThreshold', num(e.target.value))} />
            </Field>
            <Field label={t('Safety stock')} hint={t('Optional — extra buffer added to the reorder point')}>
              <input type="number" min={0} className="input" placeholder={t('Optional')} value={d.safetyStock ?? ''} onChange={(e) => set('safetyStock', num(e.target.value))} />
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
              <p className="text-sm font-semibold">{t('Circularity score')}</p>
              <p className="muted text-xs">{score === null ? t('Fill in each material’s weight and type to calculate') : t('Share of weight from recycled/reused inputs')}</p>
            </div>
          </div>
          <div className="border-t border-gray-200 pt-4 dark:border-white/10">
            <p className="text-sm font-semibold">{t('Reorder point')}</p>
            {rop === null ? (
              <p className="muted mt-1 text-xs leading-relaxed">{t('Needs a linked supplier with a lead time.')}</p>
            ) : (
              <>
                <p className="num mt-1 text-2xl">{t('{count} units', { count: rop })}</p>
                <p className="muted mt-1 text-xs leading-relaxed">
                  {t('({avg}/day sold × {lead}d lead) + {safety} safety', { avg: fmtNum(avg, 2), lead: lead!, safety: d.safetyStock ?? 0 })}
                  {avg === 0 && ` — ${t('no sales logged yet')}`}
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
