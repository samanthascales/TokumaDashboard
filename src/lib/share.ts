import type { PillarKey, ScoreLevel } from './score';
import type { ReadinessLevel } from './readiness';

/**
 * A read-only snapshot an owner shares with a lender, investor, mentor or
 * customers. The whole report travels inside the link (base64url JSON after
 * #/r/), so Tokuma never stores it and nobody else can open it without the
 * link. It does not update after it is created.
 */
export type ReportKind = 'lender' | 'impact';

export interface SharedReport {
  v: 1;
  kind: ReportKind;
  /** ISO date the snapshot was made. */
  created: string;
  business: { name: string; industry: string; country: string; description: string };
  /** Free text from the owner shown at the top. */
  note: string;
  financial?: {
    revenue: number;
    expenses: number;
    profit: number;
    revenue12m: number;
    profit12m: number;
  };
  balance?: { cash: number; assets: number; liabilities: number; equity: number; runwayMonths: number | null };
  readiness?: { score: number; level: ReadinessLevel };
  circularity?: {
    score: number | null;
    level: ScoreLevel | null;
    range: [number, number] | null;
    pillars: { key: PillarKey; value: number | null; raw: number | null }[];
    circularKg: number;
    wasteKg: number;
    products: { name: string; score: number }[];
  };
}

const MAX_LINK = 6000;

function toBase64Url(s: string) {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function encodeReport(r: SharedReport) {
  return toBase64Url(JSON.stringify(r));
}

/** The full link to open a report, on whatever address the app is served from. */
export function reportLink(r: SharedReport) {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#/r/${encodeReport(r)}`;
}

export const linkTooLong = (r: SharedReport) => encodeReport(r).length > MAX_LINK;

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const numOrNull = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown, max = 300) => (typeof v === 'string' ? v.slice(0, max) : '');
const PILLAR_KEYS: PillarKey[] = ['inflow', 'outflow', 'life', 'productivity', 'businessModel'];

/**
 * Reads a report from a link. The link may have been edited by anyone, so every
 * field is checked and anything unexpected is dropped; returns null if it can't be read.
 */
export function decodeReport(data: string): SharedReport | null {
  try {
    const raw = JSON.parse(fromBase64Url(data)) as Record<string, unknown>;
    if (!raw || raw.v !== 1 || (raw.kind !== 'lender' && raw.kind !== 'impact')) return null;
    const b = (raw.business ?? {}) as Record<string, unknown>;
    const out: SharedReport = {
      v: 1,
      kind: raw.kind,
      created: /^\d{4}-\d{2}-\d{2}$/.test(str(raw.created)) ? str(raw.created) : '',
      business: { name: str(b.name, 120), industry: str(b.industry, 80), country: str(b.country, 80), description: str(b.description, 400) },
      note: str(raw.note, 600),
    };
    const f = raw.financial as Record<string, unknown> | undefined;
    if (f) out.financial = { revenue: num(f.revenue), expenses: num(f.expenses), profit: num(f.profit), revenue12m: num(f.revenue12m), profit12m: num(f.profit12m) };
    const bal = raw.balance as Record<string, unknown> | undefined;
    if (bal) out.balance = { cash: num(bal.cash), assets: num(bal.assets), liabilities: num(bal.liabilities), equity: num(bal.equity), runwayMonths: numOrNull(bal.runwayMonths) };
    const r = raw.readiness as Record<string, unknown> | undefined;
    if (r && ['early', 'building', 'ready'].includes(r.level as string)) out.readiness = { score: Math.max(0, Math.min(100, num(r.score))), level: r.level as ReadinessLevel };
    const c = raw.circularity as Record<string, unknown> | undefined;
    if (c) {
      const level = ['starter', 'grower', 'leader'].includes(c.level as string) ? (c.level as ScoreLevel) : null;
      const range = Array.isArray(c.range) && c.range.length === 2 ? ([num(c.range[0]), num(c.range[1])] as [number, number]) : null;
      const pillars = (Array.isArray(c.pillars) ? c.pillars : [])
        .filter((p): p is Record<string, unknown> => !!p && PILLAR_KEYS.includes((p as Record<string, unknown>).key as PillarKey))
        .map((p) => ({ key: p.key as PillarKey, value: numOrNull(p.value), raw: numOrNull(p.raw) }));
      const products = (Array.isArray(c.products) ? c.products : []).slice(0, 12).map((p) => ({ name: str((p as Record<string, unknown>)?.name, 80), score: num((p as Record<string, unknown>)?.score) }));
      out.circularity = { score: numOrNull(c.score), level, range, pillars, circularKg: num(c.circularKg), wasteKg: num(c.wasteKg), products };
    }
    return out;
  } catch {
    return null;
  }
}
