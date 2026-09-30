import { getLocale, getLang, t } from '../i18n';

// Formatters follow the selected language. Amounts stay in US dollars.
const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat | Intl.RelativeTimeFormat>();
function fmt<T extends Intl.NumberFormat | Intl.DateTimeFormat | Intl.RelativeTimeFormat>(kind: string, make: (loc: string) => T): T {
  const k = getLocale() + '|' + kind;
  let f = cache.get(k) as T | undefined;
  if (!f) cache.set(k, (f = make(getLocale())));
  return f;
}
// In right-to-left languages a formatted amount ("-362 US$", "3.2 kg", "+4.4%") must stay one
// left-to-right unit, or the bidi algorithm moves the sign and unit around it.
const ltr = (s: string) => (getLang() === 'ar' ? `\u2066${s}\u2069` : s);

const num = (digits: number) =>
  fmt('n' + digits, (l) => new Intl.NumberFormat(l, { minimumFractionDigits: digits, maximumFractionDigits: digits }));

export const fmtMoney = (n: number) => ltr(fmt('c0', (l) => new Intl.NumberFormat(l, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })).format(n));
export const fmtMoney2 = (n: number) =>
  ltr(fmt('c2', (l) => new Intl.NumberFormat(l, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })).format(n));
export const fmtCompactMoney = (n: number) =>
  Math.abs(n) < 1000
    ? fmtMoney(n)
    : ltr(fmt('cc', (l) => new Intl.NumberFormat(l, { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 })).format(n));
export const fmtInt = (n: number) => fmt('i', (l) => new Intl.NumberFormat(l, { maximumFractionDigits: 0 })).format(n);
export const fmtCompact = (n: number) => fmt('k', (l) => new Intl.NumberFormat(l, { notation: 'compact', maximumFractionDigits: 1 })).format(n);
/** A decimal number with a fixed number of digits, in the selected language's style. */
export const fmtNum = (n: number, digits = 1) => ltr(num(digits).format(n));
/** `n` is a percentage (12.5 → "12.5%"). */
export const fmtPct = (n: number, digits = 1) =>
  ltr(fmt('p' + digits, (l) => new Intl.NumberFormat(l, { style: 'percent', minimumFractionDigits: digits, maximumFractionDigits: digits })).format(n / 100));
export const fmtKg = (n: number) => ltr(n >= 1000 ? `${num(2).format(n / 1000)} t` : `${num(n < 10 ? 1 : 0).format(n)} kg`);

export function fmtDelta(n: number, digits = 1) {
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return ltr(`${sign}${fmtPct(Math.abs(n), digits)}`);
}

export function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISO(s: string) {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export const fmtDate = (s: string) => fmt('d', (l) => new Intl.DateTimeFormat(l, { month: 'short', day: 'numeric', year: 'numeric' })).format(parseISO(s));
export const fmtShortDate = (d: Date) => fmt('sd', (l) => new Intl.DateTimeFormat(l, { month: 'short', day: 'numeric' })).format(d);
export const fmtMonth = (d: Date) => fmt('m', (l) => new Intl.DateTimeFormat(l, { month: 'short', year: '2-digit' })).format(d);
export const fmtMonthName = (d: Date) => fmt('mn', (l) => new Intl.DateTimeFormat(l, { month: 'long' })).format(d);

export function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return t('just now');
  const rel = fmt('r', (l) => new Intl.RelativeTimeFormat(l, { numeric: 'always', style: 'narrow' }));
  if (min < 60) return rel.format(-min, 'minute');
  const h = Math.round(min / 60);
  if (h < 24) return rel.format(-h, 'hour');
  const d = Math.round(h / 24);
  if (d < 30) return rel.format(-d, 'day');
  return fmtDate(iso);
}

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
