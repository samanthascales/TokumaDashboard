import type { Customer, Product, Transaction } from '../types';
import { toISO, uid } from './format';
import { t, tk } from '../i18n';

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
  if (name.endsWith('.xls')) throw new Error(t('Old .xls files aren’t supported. In Excel, use File → Save As → Excel Workbook (.xlsx) or CSV, then import that.'));
  throw new Error(t('Choose a .csv or .xlsx file.'));
}

/* ------------------------------------------------------------------ */
/* Column mapping                                                      */
/* ------------------------------------------------------------------ */

export type FieldKey = 'date' | 'amount' | 'unitPrice' | 'type' | 'category' | 'product' | 'quantity' | 'customer' | 'note';

export const FIELDS: { key: FieldKey; label: string; required?: boolean; help: string }[] = [
  { key: 'date', label: tk('Date'), required: true, help: tk('When the money moved') },
  { key: 'amount', label: tk('Amount (line total)'), help: tk('Negative numbers or a Type column mark money out') },
  { key: 'unitPrice', label: tk('Unit price'), help: tk('Used with Quantity when a row has no line total') },
  { key: 'type', label: tk('Type (in / out)'), help: tk('e.g. “in”, “out”, “income”, “expense”, “credit”, “debit”') },
  { key: 'category', label: tk('Category'), help: tk('e.g. Product sale, Materials, Rent') },
  { key: 'product', label: tk('Product'), help: tk('Matched to your products by name or SKU') },
  { key: 'quantity', label: tk('Quantity'), help: tk('Units sold') },
  { key: 'customer', label: tk('Customer'), help: tk('Matched by name or email') },
  { key: 'note', label: tk('Description / note'), help: tk('Any free text') },
];

// Listed most specific first: when several headers could match, the earlier synonym wins.
// Covers common bank exports and sales exports (Shopify, Square, Etsy, Stripe, WooCommerce),
// plus Spanish, Portuguese, French, Dutch and Arabic headers.
const SYNONYMS: Record<FieldKey, string[]> = {
  date: ['date', 'transaction date', 'sale date', 'order date', 'created at', 'paid at', 'date created', 'posting date', 'posted', 'day', 'created', 'timestamp', 'fecha', 'data', 'datum', 'التاريخ', 'تاريخ'],
  amount: ['amount', 'line total', 'lineitem total', 'item total', 'total', 'net sales', 'gross sales', 'sale amount', 'order total', 'order value', 'subtotal', 'value', 'sum', 'gross', 'net', 'amount ($)', 'amount (usd)', 'monto', 'importe', 'valor', 'montant', 'bedrag', 'المبلغ', 'مبلغ'],
  unitPrice: ['unit price', 'lineitem price', 'item price', 'price each', 'price per unit', 'price', 'precio unitario', 'preço unitário', 'prix unitaire', 'precio', 'preço', 'prix', 'prijs', 'السعر'],
  type: ['type', 'transaction type', 'direction', 'in/out', 'flow', 'debit/credit', 'dr/cr', 'tipo', 'sens', 'soort', 'النوع'],
  category: ['category', 'account', 'class', 'group', 'expense type', 'income type', 'categoría', 'categoria', 'catégorie', 'categorie', 'الفئة'],
  product: ['product', 'product name', 'lineitem name', 'item name', 'item', 'title', 'sku', 'lineitem sku', 'product/service', 'producto', 'produto', 'produit', 'artículo', 'artigo', 'article', 'المنتج'],
  quantity: ['quantity', 'lineitem quantity', 'qty', 'units', 'unit count', 'count', 'cantidad', 'quantidade', 'quantité', 'aantal', 'الكمية'],
  customer: ['customer', 'customer name', 'client', 'buyer', 'billing name', 'ship name', 'customer email', 'email', 'payee', 'name', 'cliente', 'client', 'klant', 'العميل', 'nombre', 'nome', 'nom'],
  note: ['note', 'notes', 'description', 'memo', 'details', 'reference', 'narration', 'descripción', 'descrição', 'nota', 'omschrijving', 'الوصف', 'ملاحظات'],
};

export type Mapping = Record<FieldKey, number | null>;

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/** Order-level totals: on line-item exports (Shopify) they sit on one row per order, not per item. */
const ORDER_LEVEL_TOTALS = ['total', 'subtotal', 'order total', 'order value'];

/** Guesses which column holds each field from the header names. Each column is used at most once. */
export function guessMapping(header: Cell[], opts: { sales?: boolean } = {}): Mapping {
  const heads = header.map(norm);
  const used = new Set<number>();
  const m = {} as Mapping;
  for (const f of FIELDS) {
    // In a sales export "Category" is usually the product's category (e.g. "Bags"), not a transaction type.
    if (opts.sales && (f.key === 'category' || f.key === 'type')) {
      m[f.key] = null;
      continue;
    }
    let idx = -1;
    for (const syn of SYNONYMS[f.key]) {
      idx = heads.findIndex((h, i) => !used.has(i) && h === syn);
      if (idx >= 0) break;
    }
    if (idx < 0)
      for (const syn of SYNONYMS[f.key]) {
        idx = heads.findIndex((h, i) => !used.has(i) && h.length > 0 && h.includes(syn));
        if (idx >= 0) break;
      }
    m[f.key] = idx >= 0 ? idx : null;
    if (idx >= 0) used.add(idx);
  }
  // With per-item price and quantity, an order-level total would double-count multi-item orders.
  if (m.unitPrice !== null && m.quantity !== null && m.amount !== null && ORDER_LEVEL_TOTALS.includes(heads[m.amount]!)) m.amount = null;
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
  s = s.replace(/[$€£¥\s]/g, '').replace(/(USD|CAD|EUR|GBP|BRL|ARS|CLP|COP|PEN|MXN|R\$|S\/)/gi, '');
  // "1.234,50" or "12,5" (comma decimals, common outside the US) vs "1,234.50".
  s = /^-?[\d.]*,\d{1,2}-?$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
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

const IN_WORDS = ['in', 'inflow', 'income', 'credit', 'cr', 'revenue', 'sale', 'sales', 'deposit', 'received', 'money in', '+', 'entrada', 'ingreso', 'ingresos', 'venta', 'receita', 'venda', 'entrée', 'recette', 'vente', 'inkomsten', 'دخل'];
const OUT_WORDS = ['out', 'outflow', 'expense', 'expenses', 'debit', 'dr', 'cost', 'purchase', 'payment', 'withdrawal', 'paid', 'money out', '-', 'salida', 'gasto', 'gastos', 'egreso', 'saída', 'despesa', 'sortie', 'dépense', 'uitgaven', 'مصروف'];

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
  ctx: { products: Product[]; customers: Customer[]; existing: Transaction[]; createCustomers: boolean; today: string; /** Importing a sales export: rows default to Product sale, negatives to Refund. */ sales?: boolean },
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
  const key = (x: Omit<Transaction, 'id'>) => [x.date, x.type, x.amount.toFixed(2), norm(x.category), x.productId ?? '', x.quantity ?? ''].join('|');
  const seen = new Set(ctx.existing.map(key));
  const get = (row: Cell[], f: FieldKey) => (mapping[f] === null ? null : (row[mapping[f]!] ?? null));

  const rows: PreviewRow[] = [];
  table.slice(1).forEach((row, i) => {
    const line = i + 2;
    if (row.every((c) => c === null || String(c).trim() === '')) return;
    const messages: string[] = [];
    const date = parseDate(get(row, 'date'), order);
    if (!date) messages.push(t('Date “{value}” isn’t a date', { value: cellText(get(row, 'date')) }));
    else if (date > ctx.today) messages.push(t('Date is in the future'));

    const qtyCell = get(row, 'quantity');
    let quantity: number | undefined;
    if (mapping.quantity !== null && cellText(qtyCell) !== '') {
      const q = parseAmount(qtyCell);
      if (q === null || q <= 0 || !Number.isInteger(q)) messages.push(t('Quantity “{value}” isn’t a whole number', { value: cellText(qtyCell) }));
      else quantity = q;
    }

    // Amount: the line total if there is one, otherwise unit price × quantity.
    const amountText = cellText(get(row, 'amount'));
    const priceText = cellText(get(row, 'unitPrice'));
    let rawAmount: number | null = null;
    if (amountText !== '') {
      rawAmount = parseAmount(get(row, 'amount'));
      if (rawAmount === null) messages.push(t('Amount “{value}” isn’t a number', { value: amountText }));
    } else if (priceText !== '') {
      const unit = parseAmount(get(row, 'unitPrice'));
      if (unit === null) messages.push(t('Unit price “{value}” isn’t a number', { value: priceText }));
      else if (!quantity) messages.push(t('Has a unit price but no quantity, so the total isn’t known'));
      else rawAmount = Math.round(unit * quantity * 100) / 100;
    } else {
      messages.push(mapping.unitPrice !== null ? t('No amount or unit price') : t('No amount'));
    }
    if (rawAmount === 0) messages.push(t('Amount is 0'));

    let type: 'inflow' | 'outflow' | null = null;
    if (mapping.type !== null) {
      type = parseType(get(row, 'type'));
      if (!type && rawAmount !== null) type = rawAmount < 0 ? 'outflow' : null;
      if (!type) messages.push(t('Type “{value}” isn’t “in” or “out”', { value: cellText(get(row, 'type')) }));
    } else if (rawAmount !== null) {
      type = rawAmount < 0 ? 'outflow' : 'inflow';
    }

    if (messages.length) {
      rows.push({ line, status: 'error', messages });
      return;
    }

    const warnings: string[] = [];
    const productText = cellText(get(row, 'product'));
    const product = productText ? byName.get(norm(productText)) : undefined;
    if (productText && !product) warnings.push(t('No product called “{name}” — imported without a product link', { name: productText }));

    const customerText = cellText(get(row, 'customer'));
    let customer = customerText ? custByKey.get(norm(customerText)) : undefined;
    if (customerText && !customer) {
      if (ctx.createCustomers) {
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerText);
        customer = { id: uid('cus'), name: isEmail ? customerText.split('@')[0]! : customerText, email: isEmail ? customerText : '', city: '', joinedDate: date! };
        newCustomers.push(customer);
        custByKey.set(norm(customerText), customer);
        warnings.push(t('New customer “{name}” will be added', { name: customerText }));
      } else warnings.push(t('No customer called “{name}” — imported without a customer', { name: customerText }));
    }

    const categoryText = cellText(get(row, 'category'));
    const category =
      categoryText || (type === 'inflow' ? (product || ctx.sales ? 'Product sale' : 'Other income') : ctx.sales ? tk('Refund') : 'Other expense');
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
    if (product && type === 'inflow' && !quantity) warnings.push(t('No quantity — this sale won’t count toward circularity or sales rate'));

    // Only rows matching data already in the app count as duplicates — two identical
    // sales in one file (same item, same day) are both real.
    if (seen.has(key(tx))) {
      rows.push({ line, status: 'duplicate', messages: [t('Matches a transaction you already have')], tx, productName: product?.name, customerName: customer?.name });
      return;
    }
    rows.push({ line, status: warnings.length ? 'warning' : 'ok', messages: warnings, tx, productName: product?.name, customerName: customer?.name });
  });
  return { rows, newCustomers };
}

export const TEMPLATE_CSV = 'date,type,category,amount,product,quantity,customer,note\n';
