import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { certificationScore, leadTimeScore, reliabilityScore } from '../../lib/metrics';
import { Field, Gauge, Modal } from '../../components/ui';
import type { Supplier, TransportMethod } from '../../types';
import { tk, useLang, useT } from '../../i18n';
import { fmtNum } from '../../lib/format';

const TRANSPORT: TransportMethod[] = [tk('Sea'), tk('Rail'), tk('Road'), tk('Air')] as TransportMethod[];

type Draft = Omit<Supplier, 'id'> & { id?: string };
const empty: Draft = {
  name: '',
  country: '',
  city: '',
  transportMethod: 'Road',
  sustainabilityRating: null,
  carbonEmissionsKg: null,
  certifications: [],
  materialsSupplied: [],
  avgLeadTimeDays: null,
  onTimeDeliveryRate: null,
};
const CERTS = ['GOTS', 'GRS', 'OEKO-TEX', 'B Corp', 'Fair Trade', 'RWS', 'FSC', 'Cradle to Cradle'];

function ChipInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const t = useT();
  const [text, setText] = useState('');
  const add = () => {
    const v = text.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setText('');
  };
  return (
    <div className="input flex min-h-[40px] flex-wrap items-center gap-1.5 py-1.5">
      {value.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs dark:bg-white/10">
          {v}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} aria-label={t('Remove {name}', { name: v })}>
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        className="min-w-[120px] flex-1 bg-transparent text-sm outline-none"
        value={text}
        placeholder={value.length ? '' : placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add();
          } else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={add}
      />
    </div>
  );
}

export function SupplierModal({ open, onClose, supplier }: { open: boolean; onClose: () => void; supplier?: Supplier | null }) {
  const t = useT();
  const { lang } = useLang();
  const { addSupplier, updateSupplier } = useStore();
  const [d, setD] = useState<Draft>(empty);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (open) {
      setD(supplier ? { ...supplier } : { ...empty });
      setTouched({});
    }
  }, [open, supplier]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setD((x) => ({ ...x, [k]: v }));
    setTouched((x) => ({ ...x, [k]: true }));
  };
  const errors = useMemo(
    () => ({
      name: d.name.trim().length < 2 ? t('Supplier name is required') : null,
      country: !d.country.trim() ? t('Country is required') : null,
      // All measurements are optional; when entered they must be in range.
      avgLeadTimeDays: d.avgLeadTimeDays !== null && (d.avgLeadTimeDays <= 0 || d.avgLeadTimeDays > 180) ? t('Enter 1–180 days') : null,
      onTimeDeliveryRate: d.onTimeDeliveryRate !== null && (d.onTimeDeliveryRate < 0 || d.onTimeDeliveryRate > 100) ? t('Enter 0–100%') : null,
      sustainabilityRating: d.sustainabilityRating !== null && (d.sustainabilityRating < 0 || d.sustainabilityRating > 100) ? t('Enter 0–100') : null,
      carbonEmissionsKg: d.carbonEmissionsKg !== null && d.carbonEmissionsKg < 0 ? t('Cannot be negative') : null,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- messages follow the language
    [d, lang],
  );
  const show = (k: keyof typeof errors) => (touched[k] ? errors[k] : null);
  const valid = Object.values(errors).every((e) => !e);
  const score = reliabilityScore(d);
  // Blank input → null (not entered), never 0.
  const num = (v: string) => (v.trim() === '' ? null : Number(v));

  const save = () => {
    setTouched({ name: true, country: true, avgLeadTimeDays: true, onTimeDeliveryRate: true, sustainabilityRating: true });
    if (!valid) return;
    const { id, ...rest } = d;
    if (id) updateSupplier({ ...rest, id });
    else addSupplier(rest);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={supplier ? t('Edit {name}', { name: supplier.name }) : t('Add new supplier')}
      sub={t("Lead time and on-time delivery feed the reliability score and every linked product's reorder point")}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            {t('Cancel')}
          </button>
          <button className="btn-primary" onClick={save}>
            {supplier ? t('Save changes') : t('Add supplier')}
          </button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_240px]">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('Supplier name')} error={show('name')} className="sm:col-span-2">
            <input className={`input ${show('name') ? 'input-error' : ''}`} value={d.name} onChange={(e) => set('name', e.target.value)} placeholder={t('e.g. EcoFab Textiles')} />
          </Field>
          <Field label={t('City')}>
            <input className="input" value={d.city} onChange={(e) => set('city', e.target.value)} />
          </Field>
          <Field label={t('Country')} error={show('country')}>
            <input className={`input ${show('country') ? 'input-error' : ''}`} value={d.country} onChange={(e) => set('country', e.target.value)} />
          </Field>
          <Field label={t('Transport method')}>
            <select className="input" value={d.transportMethod} onChange={(e) => set('transportMethod', e.target.value as TransportMethod)}>
              {TRANSPORT.map((m) => (
                <option key={m} value={m}>
                  {t(m)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('Logistics carbon (kg CO₂e / yr)')}>
            <input type="number" min={0} className="input" placeholder={t('Optional')} value={d.carbonEmissionsKg ?? ''} onChange={(e) => set('carbonEmissionsKg', num(e.target.value))} />
          </Field>
          <Field label={t('Sustainability rating (0–100)')} error={show('sustainabilityRating')}>
            <input type="number" min={0} max={100} className="input" placeholder={t('Optional')} value={d.sustainabilityRating ?? ''} onChange={(e) => set('sustainabilityRating', num(e.target.value))} />
          </Field>
          <div />
          <Field
            label={t('Avg lead time (days)')}
            error={show('avgLeadTimeDays')}
            hint={d.avgLeadTimeDays !== null ? t('Lead-time score {score}/100', { score: Math.round(leadTimeScore(d.avgLeadTimeDays)) }) : t('Days from order to delivery')}
          >
            <input type="number" min={1} className={`input ${show('avgLeadTimeDays') ? 'input-error' : ''}`} placeholder={t('e.g. {n}', { n: 12 })} value={d.avgLeadTimeDays ?? ''} onChange={(e) => set('avgLeadTimeDays', num(e.target.value))} />
          </Field>
          <Field label={t('On-time delivery (%)')} error={show('onTimeDeliveryRate')}>
            <input type="number" min={0} max={100} className={`input ${show('onTimeDeliveryRate') ? 'input-error' : ''}`} placeholder={t('e.g. {n}', { n: 95 })} value={d.onTimeDeliveryRate ?? ''} onChange={(e) => set('onTimeDeliveryRate', num(e.target.value))} />
          </Field>
          <div className="sm:col-span-2">
            <span className="label">{t('Certifications')}</span>
            <div className="flex flex-wrap gap-1.5">
              {CERTS.map((c) => {
                const on = d.certifications.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set('certifications', on ? d.certifications.filter((x) => x !== c) : [...d.certifications, c])}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition ${on ? 'bg-brand-600 text-white ring-brand-600' : 'text-gray-600 ring-gray-200 hover:ring-gray-300 dark:text-gray-300 dark:ring-white/10'}`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
          <Field label={t('Materials supplied')} hint={t('Press Enter to add')} className="sm:col-span-2">
            <ChipInput value={d.materialsSupplied} onChange={(v) => set('materialsSupplied', v)} placeholder={t('e.g. Recycled cotton')} />
          </Field>
        </div>
        <aside className="flex flex-col items-center rounded-xl bg-gray-50 p-4 text-center dark:bg-white/[0.03]">
          <p className="text-sm font-semibold">{t('Reliability preview')}</p>
          <div className="my-3">
            <Gauge value={score} size={120} label={t('score')} />
          </div>
          {score === null && <p className="muted -mt-1 mb-3 text-xs">{t('Enter lead time and on-time delivery to calculate a score.')}</p>}
          <div className="w-full space-y-2 text-start text-xs">
            {(
              [
                [t('Lead time'), d.avgLeadTimeDays === null ? null : leadTimeScore(d.avgLeadTimeDays), 0.3],
                [t('On-time delivery'), d.onTimeDeliveryRate, 0.5],
                [t('Certifications'), certificationScore(d.certifications), 0.2],
              ] as [string, number | null, number][]
            ).map(([k, v, w]) => (
              <div key={k}>
                <div className="flex justify-between">
                  <span className="muted">
                    {k} × {fmtNum(w)}
                  </span>
                  <span className="font-semibold tabular-nums">{v === null ? '—' : fmtNum(v * w)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
                  <div className="h-full rounded-full bg-brand-600 transition-all dark:bg-brand-400" style={{ width: `${v ?? 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </Modal>
  );
}
