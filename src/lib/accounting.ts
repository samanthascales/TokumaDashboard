import type { Asset, Liability, Product, Transaction } from '../types';
import { FINANCING_CATEGORIES, type Window } from './metrics';
import { CIRCULAR_INCOME_CATEGORIES } from './score';
import { addDays, startOfToday, toISO } from './format';

/** Categories treated as fixed monthly costs in the break-even calculator. */
export const FIXED_COST_CATEGORIES = new Set(['Payroll', 'Rent & utilities', 'Marketing']);

const inWindow = (t: Transaction, w: Window) => t.date >= toISO(w.from) && t.date <= toISO(w.to);

export interface Line {
  category: string;
  amount: number;
}

function group(txs: Transaction[]): Line[] {
  const m = new Map<string, number>();
  for (const t of txs) m.set(t.category, (m.get(t.category) ?? 0) + t.amount);
  return [...m].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
}

export interface ProfitAndLoss {
  income: Line[];
  incomeTotal: number;
  expenses: Line[];
  expenseTotal: number;
  /** Income − expenses. Loans, investment and grants are left out. */
  profit: number;
  /** Money in that is not profit: loans, investment, grants. */
  financing: Line[];
  circularIncome: number;
  /** Share (0–100) of income from circular activities; null when there was no income. */
  circularIncomeShare: number | null;
}

/** A simple cash-basis profit & loss: what came in and went out in the window, by category. */
export function profitAndLoss(txs: Transaction[], w: Window): ProfitAndLoss {
  const scoped = txs.filter((t) => inWindow(t, w));
  const ins = scoped.filter((t) => t.type === 'inflow');
  const incomeTx = ins.filter((t) => !FINANCING_CATEGORIES.has(t.category));
  const income = group(incomeTx);
  const expenses = group(scoped.filter((t) => t.type === 'outflow'));
  const incomeTotal = income.reduce((s, l) => s + l.amount, 0);
  const expenseTotal = expenses.reduce((s, l) => s + l.amount, 0);
  const circularIncome = incomeTx.filter((t) => CIRCULAR_INCOME_CATEGORIES.has(t.category)).reduce((s, t) => s + t.amount, 0);
  return {
    income,
    incomeTotal,
    expenses,
    expenseTotal,
    profit: incomeTotal - expenseTotal,
    financing: group(ins.filter((t) => FINANCING_CATEGORIES.has(t.category))),
    circularIncome,
    circularIncomeShare: incomeTotal > 0 ? (circularIncome / incomeTotal) * 100 : null,
  };
}

export interface BalanceSheet {
  cash: number;
  stockValue: number;
  otherAssets: Asset[];
  assetsTotal: number;
  liabilities: Liability[];
  liabilitiesTotal: number;
  /** What the business is worth to its owner: assets − liabilities. */
  equity: number;
}

/** Cash = starting cash + all money in − all money out. Stock is valued at what it cost. */
export function cashBalance(txs: Transaction[], openingCash: number | null, upTo?: string) {
  let cash = openingCash ?? 0;
  for (const t of txs) {
    if (upTo && t.date > upTo) continue;
    cash += t.type === 'inflow' ? t.amount : -t.amount;
  }
  return cash;
}

export function balanceSheet(txs: Transaction[], products: Product[], assets: Asset[], liabilities: Liability[], openingCash: number | null): BalanceSheet {
  const cash = cashBalance(txs, openingCash);
  const stockValue = products.reduce((s, p) => s + p.stockOnHand * p.unitCost, 0);
  const assetsTotal = cash + stockValue + assets.reduce((s, a) => s + a.value, 0);
  const liabilitiesTotal = liabilities.reduce((s, l) => s + l.amount, 0);
  return { cash, stockValue, otherAssets: assets, assetsTotal, liabilities, liabilitiesTotal, equity: assetsTotal - liabilitiesTotal };
}

export interface CashMonth {
  month: Date;
  cashIn: number;
  cashOut: number;
  net: number;
  /** Cash in hand at the end of the month. */
  endCash: number;
}

/** Cash in and out for each of the last `n` calendar months, this month included. */
export function cashFlow(txs: Transaction[], openingCash: number | null, n = 6, today = startOfToday()): CashMonth[] {
  const out: CashMonth[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const from = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const end = new Date(from.getFullYear(), from.getMonth() + 1, 0);
    const to = end > today ? today : end;
    const w = { from, to };
    let cashIn = 0;
    let cashOut = 0;
    for (const t of txs) {
      if (!inWindow(t, w)) continue;
      if (t.type === 'inflow') cashIn += t.amount;
      else cashOut += t.amount;
    }
    out.push({ month: from, cashIn, cashOut, net: cashIn - cashOut, endCash: cashBalance(txs, openingCash, toISO(to)) });
  }
  return out;
}

/**
 * How many months the cash would last if no money came in, at the average
 * monthly spending of the last three months. null when nothing was spent.
 */
export function cashRunway(txs: Transaction[], cash: number, today = startOfToday()) {
  const from = addDays(today, -89);
  const spent = txs.filter((t) => t.type === 'outflow' && inWindow(t, { from, to: today })).reduce((s, t) => s + t.amount, 0);
  const monthly = spent / 3;
  if (!monthly) return null;
  return { monthlySpend: monthly, months: Math.max(0, cash / monthly) };
}

/** Average monthly fixed costs (rent, wages, marketing) over the last three months. */
export function avgFixedCosts(txs: Transaction[], today = startOfToday()) {
  const from = addDays(today, -89);
  const total = txs.filter((t) => t.type === 'outflow' && FIXED_COST_CATEGORIES.has(t.category) && inWindow(t, { from, to: today })).reduce((s, t) => s + t.amount, 0);
  return total / 3;
}

/** Profit on one item sold (price − cost), averaged over what actually sold, or over the catalog when nothing has sold. */
export function avgProfitPerItem(products: Product[], units: Record<string, number>) {
  if (!products.length) return null;
  const sold = products.filter((p) => (units[p.id] ?? 0) > 0);
  if (sold.length) {
    const n = sold.reduce((s, p) => s + units[p.id]!, 0);
    return sold.reduce((s, p) => s + (p.price - p.unitCost) * units[p.id]!, 0) / n;
  }
  return products.reduce((s, p) => s + (p.price - p.unitCost), 0) / products.length;
}

/** Items to sell each month to cover fixed costs; null when each item doesn't make a profit. */
export function breakEvenUnits(fixedCosts: number, profitPerItem: number) {
  if (profitPerItem <= 0) return null;
  return Math.ceil(fixedCosts / profitPerItem);
}
