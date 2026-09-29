import type { Customer, Product, Transaction } from '../types';
import { toISO, uid } from './format';

/* ------------------------------------------------------------------ */
/* Reading files                                                       */
/* ------------------------------------------------------------------ */

export type Cell = string | number | boolean | Date | null;

export interface SheetTable {
  name: string;
  rows: Cell[][]; // first row is the header
}

/** Reads a .csv or .xlsx file in the browser. Nothing is uploaded. Parsers load on demand. */
export async function readSpreadsheet(file: File): Promise<SheetTable[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv') || name.endsWith('.txt') || file.type === 'text/csv') {
    const Papa = (await import('papaparse')).default;
    const text = await file.text();
    const res = Papa.parse<string[]>(text.replace(/^﻿/, ''), { skipEmptyLines: 'greedy' });
    return [{ name: file.name, rows: res.data as Cell[][] }];
  }
  if (name.endsWith('.xlsx')) {
    const { default: readXlsxFile } = await import('read-excel-file/browser');
    const sheets = await readXlsxFile(file);
    return sheets.map((s) => ({ name: s.sheet, rows: s.data as unknown as Cell[][] })).filter((s) => s.rows.some((r) => r.some((c) => c !== null && c !== '')));
  }
  if (name.endsWith('.xls')) throw new Error('Old .xls files aren’t supported. In Excel, use File → Save As → Excel Workbook (.xlsx) or CSV, then import that.');
  throw new Error('Choose a .csv or .xlsx file.');
}

/* ------------------------------------------------------------------ */
/* Column mapping                                                      */
/* ------------------------------------------------------------------ */

export type FieldKey = 'date' | 'amount' | 'type' | 'category' | 'product' | 'quantity' | 'customer' | 'note';

export const FIELDS: { key: FieldKey; label: string; required?: boolean; help: string }[] = [
  { key: 'date', label: 'Date', required: true, help: 'When the money moved' },
  { key: 'amount', label: 'Amount', required: true, help: 'Negative numbers or a Type column mark money out' },
  { key: 'type', label: 'Type (in / out)', help: 'e.g. “in”, “out”, “income”, “expense”, “credit”, “debit”' },
  { key: 'category', label: 'Category', help: 'e.g. Product sale, Materials, Rent' },
  { key: 'product', label: 'Product', help: 'Matched to your products by name or SKU' },
  { key: 'quantity', label: 'Quantity', help: 'Units sold' },
  { key: 'customer', label: 'Customer', help: 'Matched by name or email' },
  { key: 'note', label: 'Description / note', help: 'Any free text' },
];

const SYNONYMS: Record<FieldKey, string[]> = {
  date: ['date', 'transaction date', 'posted', 'posting date', 'day', 'order date', 'created', 'timestamp'],
  amount: ['amount', 'total', 'value', 'price', 'sum', 'net', 'gross', 'amount ($)', 'amount (usd)'],
  type: ['type', 'direction', 'in/out', 'flow', 'debit/credit', 'dr/cr', 'transaction type'],
  category: ['category', 'account', 'class', 'group', 'expense type', 'income type'],
  product: ['product', 'item', 'sku', 'product name', 'item name', 'product/service'],
  quantity: ['quantity', 'qty', 'units', 'count', 'unit count'],
  customer: ['customer', 'client', 'buyer', 'customer name', 'email', 'customer email', 'payee', 'name'],
  note: ['note', 'notes', 'description', 'memo', 'details', 'reference', 'narration'],
};

export type Mapping = Record<FieldKey, number | null>;

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/** Guesses which column holds each field from the header names. Each column is used at most once. */
export function guessMapping(header: Cell[]): Mapping {
  const heads = header.map(norm);
  const used = new Set<number>();
  const m = {} as Mapping;
  for (const f of FIELDS) {
    let idx = heads.findIndex((h, i) => !used.has(i) && SYNONYMS[f.key].includes(h));
    if (idx < 0) idx = heads.findIndex((h, i) => !used.has(i) && h && SYNONYMS[f.key].some((s) => h.includes(s)));
    m[f.key] = idx >= 0 ? idx : null;
    if (idx >= 0) used.add(idx);
  }
  return m;
}

/* ------------------------------------------------------------------ */
/* Value parsing                                                       */
/* ------------------------------------------------------------------ */

export type DateOrder = 'MDY' | 'DMY' | 'YMD';

/** Looks at slash/dash dates to tell US (month first) from day-first. Returns null when every date is ambiguous. */
export function detectDateOrder(values: Cell[]): DateOrder | null {
  let mdy = false;
  let dmy = false;
  for (const v of values) {
    if (typeof v !== 'string') continue;
    const s = v.trim();
    if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(s)) return 'YMD';
    const m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
    if (!m) continue;
    if (+m[1]! > 12) dmy = true;
    if (+m[2]! > 12) mdy = true;
  }
  if (dmy && !mdy) return 'DMY';
  if (mdy && !dmy) return 'MDY';
  return null;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function validDate(y: number, m: number, d: number) {
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? dt : null;
}

export function parseDate(v: Cell, order: DateOrder): string | null {
  if (v === null || v === '') return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : toISO(new Date(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
  if (typeof v === 'number') {
    // Excel serial date (days since 1899-12-30), for cells not formatted as dates.
    if (v > 20000 && v < 80000) {
      const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86_400_000);
      return toISO(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    }
    return null;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) {
    const d = validDate(+m[1]!, +m[2]!, +m[3]!);
    return d ? toISO(d) : null;
  }
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    const y = m[3]!.length === 2 ? 2000 + +m[3]! : +m[3]!;
    const [a, b] = [+m[1]!, +m[2]!];
    const d = order === 'DMY' ? validDate(y, b, a) : validDate(y, a, b);
    return d ? toISO(d) : null;
  }
  // "Sep 3, 2026", "3 Sep 2026", "September 3 2026"
  m = s.toLowerCase().match(/^(\d{1,2})\s+([a-z]{3})[a-z]*\.?,?\s+(\d{4})$/) ?? null;
  if (m && MONTHS.includes(m[2]!)) {
    const d = validDate(+m[3]!, MONTHS.indexOf(m[2]!) + 1, +m[1]!);
    return d ? toISO(d) : null;
  }
  m = s.toLowerCase().match(/^([a-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})$/) ?? null;
  if (m && MONTHS.includes(m[1]!)) {
    const d = validDate(+m[3]!, MONTHS.indexOf(m[1]!) + 1, +m[2]!);
    return d ? toISO(d) : null;
  }
  return null;
}

/** "$1,234.50", "-12", "(45.00)", "1 234" → number. Returns null when it isn't a number. */
export function parseAmount(v: Cell): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v === null || typeof v === 'boolean' || v instanceof Date) return null;
  let s = String(v).trim();
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[$€£¥\s,]/g, '').replace(/(USD|CAD|EUR|GBP)/gi, '');
  if (s.startsWith('-')) {
    neg = !neg;
    s = s.slice(1);
  } else if (s.endsWith('-')) {
    neg = !neg;
    s = s.slice(0, -1);
  }
  if (!/^\d*\.?\d+$/.test(s)) return null;
  const n = Number(s);
  return neg ? -n : n;
}

const IN_WORDS = ['in', 'inflow', 'income', 'credit', 'cr', 'revenue', 'sale', 'sales', 'deposit', 'received', 'money in', '+'];
const OUT_WORDS = ['out', 'outflow', 'expense', 'expenses', 'debit', 'dr', 'cost', 'purchase', 'payment', 'withdrawal', 'paid', 'money out', '-'];

export function parseType(v: Cell): 'inflow' | 'outflow' | null {
  const s = norm(v);
  if (!s) return null;
  if (IN_WORDS.includes(s)) return 'inflow';
  if (OUT_WORDS.includes(s)) return 'outflow';
  return null;
}

/* ------------------------------------------------------------------ */
/* Building transactions                                               */
/* ------------------------------------------------------------------ */

export interface PreviewRow {
  line: number; // 1-based row number in the file, header = 1
  status: 'ok' | 'warning' | 'error' | 'duplicate';
  messages: string[];
  tx?: Omit<Transaction, 'id'>;
  productName?: string;
  customerName?: string;
}

export interface BuildResult {
  rows: PreviewRow[];
  newCustomers: Customer[];
}

const cellText = (v: Cell) => (v instanceof Date ? toISO(v) : v === null ? '' : String(v).trim());

export function buildTransactions(
  table: Cell[][],
  mapping: Mapping,
  order: DateOrder,
  ctx: { products: Product[]; customers: Customer[]; existing: Transaction[]; createCustomers: boolean; today: string },
): BuildResult {
  const byName = new Map<string, Product>();
  for (const p of ctx.products) {
    byName.set(norm(p.name), p);
    if (p.sku) byName.set(norm(p.sku), p);
  }
  const custByKey = new Map<string, Customer>();
  for (const c of ctx.customers) {
    custByKey.set(norm(c.name), c);
    if (c.email) custByKey.set(norm(c.email), c);
  }
  const newCustomers: Customer[] = [];
  const key = (t: Omit<Transaction, 'id'>) => [t.date, t.type, t.amount.toFixed(2), norm(t.category), t.productId ?? '', t.quantity ?? ''].join('|');
  const seen = new Set(ctx.existing.map(key));
  const get = (row: Cell[], f: FieldKey) => (mapping[f] === null ? null : (row[mapping[f]!] ?? null));

  const rows: PreviewRow[] = [];
  table.slice(1).forEach((row, i) => {
    const line = i + 2;
    if (row.every((c) => c === null || String(c).trim() === '')) return;
    const messages: string[] = [];
    const date = parseDate(get(row, 'date'), order);
    const rawAmount = parseAmount(get(row, 'amount'));
    if (!date) messages.push(`Date “${cellText(get(row, 'date'))}” isn’t a date`);
    else if (date > ctx.today) messages.push('Date is in the future');
    if (rawAmount === null) messages.push(`Amount “${cellText(get(row, 'amount'))}” isn’t a number`);
    else if (rawAmount === 0) messages.push('Amount is 0');

    let type: 'inflow' | 'outflow' | null = null;
    if (mapping.type !== null) {
      type = parseType(get(row, 'type'));
      if (!type && rawAmount !== null) type = rawAmount < 0 ? 'outflow' : null;
      if (!type) messages.push(`Type “${cellText(get(row, 'type'))}” isn’t “in” or “out”`);
    } else if (rawAmount !== null) {
      type = rawAmount < 0 ? 'outflow' : 'inflow';
    }

    const qtyCell = get(row, 'quantity');
    let quantity: number | undefined;
    if (mapping.quantity !== null && cellText(qtyCell) !== '') {
      const q = parseAmount(qtyCell);
      if (q === null || q <= 0 || !Number.isInteger(q)) messages.push(`Quantity “${cellText(qtyCell)}” isn’t a whole number`);
      else quantity = q;
    }

    if (messages.length) {
      rows.push({ line, status: 'error', messages });
      return;
    }

    const warnings: string[] = [];
    const productText = cellText(get(row, 'product'));
    const product = productText ? byName.get(norm(productText)) : undefined;
    if (productText && !product) warnings.push(`No product called “${productText}” — imported without a product link`);

    const customerText = cellText(get(row, 'customer'));
    let customer = customerText ? custByKey.get(norm(customerText)) : undefined;
    if (customerText && !customer) {
      if (ctx.createCustomers) {
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerText);
        customer = { id: uid('cus'), name: isEmail ? customerText.split('@')[0]! : customerText, email: isEmail ? customerText : '', city: '', joinedDate: date! };
        newCustomers.push(customer);
        custByKey.set(norm(customerText), customer);
        warnings.push(`New customer “${customerText}” will be added`);
      } else warnings.push(`No customer called “${customerText}” — imported without a customer`);
    }

    const categoryText = cellText(get(row, 'category'));
    const category = categoryText || (type === 'inflow' ? (product ? 'Product sale' : 'Other income') : 'Other expense');
    const note = cellText(get(row, 'note'));
    const tx: Omit<Transaction, 'id'> = {
      type: type!,
      category,
      amount: Math.round(Math.abs(rawAmount!) * 100) / 100,
      date: date!,
      ...(product ? { productId: product.id } : {}),
      ...(quantity ? { quantity } : {}),
      ...(customer ? { customerId: customer.id } : {}),
      ...(note ? { note } : {}),
    };
    if (product && type === 'inflow' && !quantity) warnings.push('No quantity — this sale won’t count toward circularity or sales rate');

    const k = key(tx);
    if (seen.has(k)) {
      rows.push({ line, status: 'duplicate', messages: ['Matches a transaction you already have'], tx, productName: product?.name, customerName: customer?.name });
      return;
    }
    seen.add(k);
    rows.push({ line, status: warnings.length ? 'warning' : 'ok', messages: warnings, tx, productName: product?.name, customerName: customer?.name });
  });
  return { rows, newCustomers };
}

export const TEMPLATE_CSV = 'date,type,category,amount,product,quantity,customer,note\n';
