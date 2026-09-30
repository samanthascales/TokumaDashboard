import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type {
  AppNotification,
  BusinessProfile,
  Customer,
  FundingRequest,
  FundingType,
  MaterialClass,
  NotificationPrefs,
  Product,
  Role,
  Supplier,
  ThemePref,
  Transaction,
} from '../types';
import { emptyProfile } from '../data/defaults';
import { t, useLang } from '../i18n';
import { CLOUD_ENABLED } from '../lib/cloud';
import {
  buildLedger,
  circularityFrom,
  classifyMaterial,
  customerStats,
  fundingTerms,
  generateInsights,
  inventoryRows,
  lastNDays,
  materialCircularity,
  recommendations,
  reliabilityScore,
  seasonalPeakLift,
  avgKnown,
  historyDays,
  totalsFor,
  type CircularityStats,
  type FundingTerms,
  type InventoryRow,
  type Ledger,
  type Recommendation,
} from '../lib/metrics';
import { fmtMoney, fmtMoney2, fmtPct, startOfToday, toISO, uid } from '../lib/format';

const lowStockText = (p: Product) => ({
  title: t('Low stock: {name}', { name: p.name }),
  body: t('{count} units left (threshold {threshold}).', { count: p.stockOnHand, threshold: p.lowStockThreshold }),
});
import type { CustomerStats, Insight } from '../types';

export interface Toast {
  id: string;
  kind: 'success' | 'info' | 'error';
  title: string;
  body?: string;
}

export interface Persisted {
  products: Product[];
  suppliers: Supplier[];
  transactions: Transaction[];
  customers: Customer[];
  fundingRequests: FundingRequest[];
  profile: BusinessProfile;
  prefs: NotificationPrefs;
  role: Role;
  dismissedInsights: string[];
  notifications: AppNotification[];
  fundingSeen: { apr: number | null; maxEligibility: number | null; rate: number } | null;
}

// v2: accounts start empty (v1 stored the old sample data, so it is ignored).
const STORAGE_KEY = 'tokuma-state-v2';

export function defaultState(): Persisted {
  return {
    products: [],
    suppliers: [],
    transactions: [],
    customers: [],
    fundingRequests: [],
    profile: emptyProfile,
    prefs: { lowStock: true, funding: true, supplier: true, insights: true, weeklyDigest: false },
    role: 'business',
    dismissedInsights: [],
    notifications: [],
    fundingSeen: null,
  };
}

/**
 * Earlier versions pre-filled new suppliers with 14-day lead time, 90% on-time,
 * sustainability 75 and 1,000 kg carbon, and new products with a low-stock
 * threshold of 10 and safety stock of 5. Records still holding exactly those
 * untouched values get them cleared, so no number appears that wasn't entered.
 */
function clearOldFormDefaults(s: Persisted): Persisted {
  return {
    ...s,
    suppliers: s.suppliers.map((x) =>
      x.avgLeadTimeDays === 14 && x.onTimeDeliveryRate === 90 && x.sustainabilityRating === 75 && x.carbonEmissionsKg === 1000
        ? { ...x, avgLeadTimeDays: null, onTimeDeliveryRate: null, sustainabilityRating: null, carbonEmissionsKg: null }
        : x,
    ),
    products: s.products.map((p) => (p.lowStockThreshold === 10 && p.safetyStock === 5 ? { ...p, lowStockThreshold: 0, safetyStock: 0 } : p)),
  };
}

/** Fills in any missing fields and clears legacy defaults. Used for local and cloud data alike. */
export function normalizeState(raw: Partial<Persisted> | null | undefined): Persisted {
  const base = defaultState();
  const r = raw ?? {};
  return clearOldFormDefaults({
    ...base,
    ...r,
    // Nested objects are merged too, so data saved by an older version never lacks a field.
    profile: { ...base.profile, ...(r.profile ?? {}) },
    prefs: { ...base.prefs, ...(r.prefs ?? {}) },
  });
}

/** Data saved in this browser before accounts existed (local mode). */
export function readLocalState(): Partial<Persisted> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<Persisted>) : null;
  } catch {
    return null;
  }
}

export function clearLocalState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function loadState(): Persisted {
  // With accounts on, data comes from the database after sign-in — never from this browser.
  if (CLOUD_ENABLED) return defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeState(JSON.parse(raw) as Partial<Persisted>);
  } catch {
    /* storage unavailable */
  }
  return defaultState();
}

function hostPrefersDark() {
  if (typeof window === 'undefined') return false;
  const host = document.documentElement.getAttribute('data-theme');
  if (host === 'dark' || host === 'light') return host === 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function loadThemePref(): ThemePref {
  try {
    const t = localStorage.getItem('tokuma-theme');
    if (t === 'light' || t === 'dark') return t;
  } catch {
    /* ignore */
  }
  return 'system';
}

export interface AppStore extends Persisted {
  ledger: Ledger;
  /** Earned once there's enough real data for lenders to trust the numbers. */
  verification: { verified: boolean; steps: { label: string; done: boolean }[] };
  circ30: CircularityStats;
  circPrev30: CircularityStats;
  units90: Record<string, number>;
  inventory: InventoryRow[];
  funding: FundingTerms;
  recs: Recommendation[];
  insights: Insight[];
  customerStats: CustomerStats[];
  theme: 'light' | 'dark';
  themePref: ThemePref;
  materialFilter: MaterialClass | null;
  filteredProductIds: Set<string> | null;
  toasts: Toast[];
  flashFunding: number; // increments whenever circularity-driven terms change

  setThemePref: (t: ThemePref) => void;
  setRole: (r: Role) => void;
  setMaterialFilter: (m: MaterialClass | null) => void;
  toast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: (id: string) => void;
  addProduct: (p: Omit<Product, 'id' | 'circularityScore'>) => void;
  updateProduct: (p: Product) => void;
  deleteProduct: (id: string) => void;
  restock: (productId: string, qty: number) => void;
  addSupplier: (s: Omit<Supplier, 'id'>) => void;
  updateSupplier: (s: Supplier) => void;
  addTransaction: (t: Omit<Transaction, 'id'>) => void;
  addCustomer: (c: Omit<Customer, 'id' | 'joinedDate'>) => string;
  /** Adds many transactions (and any new customers they reference) in one step. Stock levels are not changed. */
  importTransactions: (txs: Omit<Transaction, 'id'>[], newCustomers: Customer[], noun?: 'transaction' | 'sale') => void;
  requestFunding: (r: { type: FundingType; amount: number; purpose: string }) => void;
  applyMaterialSwitch: (productId: string, materialName: string) => void;
  dismissInsight: (id: string) => void;
  restoreInsights: () => void;
  markAllRead: () => void;
  markRead: (id: string) => void;
  /** Saves the profile; `message` replaces the default "Business profile saved" toast. */
  setProfile: (p: BusinessProfile, message?: string) => void;
  setPrefs: (p: NotificationPrefs) => void;
  markFundingSeen: () => void;
  resetData: () => void;
  /** Replaces all persisted data at once (loading an account, or opening a support view). */
  replaceAll: (next: Partial<Persisted> | null) => void;
  /** The raw persisted data, for saving to the database. */
  snapshot: Persisted;
}

const Ctx = createContext<AppStore | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>(loadState);
  const [themePref, setThemePrefState] = useState<ThemePref>(loadThemePref);
  const [systemDark, setSystemDark] = useState(hostPrefersDark);
  const theme: 'light' | 'dark' = themePref === 'system' ? (systemDark ? 'dark' : 'light') : themePref;
  const [materialFilter, setMaterialFilter] = useState<MaterialClass | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [flashFunding, setFlashFunding] = useState(0);

  const patch = useCallback((p: Partial<Persisted> | ((s: Persisted) => Partial<Persisted>)) => {
    setState((s) => ({ ...s, ...(typeof p === 'function' ? p(s) : p) }));
  }, []);

  // Persist locally only in local mode; with accounts on, CloudProvider saves to the database.
  useEffect(() => {
    if (CLOUD_ENABLED) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore quota / private mode */
    }
  }, [state]);

  // Theme
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const h = () => setSystemDark(hostPrefersDark());
    mq.addEventListener('change', h);
    // An embedding host may set data-theme on <html>; follow it when present.
    const mo = new MutationObserver(h);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      mq.removeEventListener('change', h);
      mo.disconnect();
    };
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const setThemePref = useCallback((t: ThemePref) => {
    setThemePrefState(t);
    try {
      if (t === 'system') localStorage.removeItem('tokuma-theme');
      else localStorage.setItem('tokuma-theme', t);
    } catch {
      /* ignore */
    }
  }, []);

  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = uid('t');
    setToasts((ts) => [...ts, { ...t, id }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 4200);
  }, []);
  const dismissToast = useCallback((id: string) => setToasts((ts) => ts.filter((x) => x.id !== id)), []);

  const pushNotification = useCallback(
    (n: Omit<AppNotification, 'id' | 'date' | 'read'>) =>
      patch((s) => ({ notifications: [{ ...n, id: uid('n'), date: new Date().toISOString(), read: false }, ...s.notifications].slice(0, 40) })),
    [patch],
  );

  /* ---------------- derived data ---------------- */
  // Text built here (insights, checklist labels) follows the selected language.
  const { lang } = useLang();
  const { transactions, customers } = state;
  const ledger = useMemo(() => buildLedger(transactions), [transactions]);
  const units30 = useMemo(() => totalsFor(ledger, lastNDays(30)).units, [ledger]);
  const unitsPrev30 = useMemo(() => totalsFor(ledger, lastNDays(30, 30)).units, [ledger]);
  const units90 = useMemo(() => totalsFor(ledger, lastNDays(90)).units, [ledger]);
  const circ30 = useMemo(() => circularityFrom(state.products, units30), [state.products, units30]);
  const circPrev30 = useMemo(() => circularityFrom(state.products, unitsPrev30), [state.products, unitsPrev30]);
  const inventory = useMemo(() => inventoryRows(state.products, state.suppliers, ledger), [state.products, state.suppliers, ledger]);
  const stats = useMemo(() => customerStats(customers, transactions), [customers, transactions]);
  const funding = useMemo(() => {
    const yr = totalsFor(ledger, lastNDays(365));
    const avgSust = avgKnown(state.suppliers.map((x) => x.sustainabilityRating));
    return fundingTerms(circ30.hasData ? circ30.rate : null, yr.revenue, avgSust, yr.revenue ? yr.profit / yr.revenue : 0);
  }, [ledger, state.suppliers, circ30.rate]);
  const recs = useMemo(() => recommendations(state.products, units90), [state.products, units90]);
  const verification = useMemo(() => {
    const salesDays = historyDays(transactions.filter((t) => t.type === 'inflow' && t.productId));
    const steps = [
      { label: t('Add a product with its materials'), done: state.products.some((p) => p.materials.length > 0) },
      { label: t('Add a supplier'), done: state.suppliers.length > 0 },
      { label: t('Log 30 days of sales'), done: salesDays >= 30 },
    ];
    return { verified: steps.every((s) => s.done), steps };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.products, state.suppliers, transactions, lang]);
  const peakLift = useMemo(() => seasonalPeakLift(ledger), [ledger]);
  const insights = useMemo(
    () =>
      generateInsights({ inventory, suppliers: state.suppliers, recs, funding, customers: stats, peakLift }).filter(
        (i) => !state.dismissedInsights.includes(i.id),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inventory, state.suppliers, recs, funding, stats, peakLift, state.dismissedInsights, lang],
  );
  const filteredProductIds = useMemo(() => {
    if (!materialFilter) return null;
    return new Set(state.products.filter((p) => p.materials.some((m) => classifyMaterial(m) === materialFilter)).map((p) => p.id));
  }, [materialFilter, state.products]);

  // Celebrate circularity changes so the "data unlocks capital" link is felt app-wide.
  // Only when both the old and new rate come from real sales — the first sale
  // isn't an "improvement" from 0%.
  const prevRate = useRef<number | null>(circ30.hasData ? circ30.rate : null);
  const prevApr = useRef(funding.apr);
  useEffect(() => {
    const before = prevRate.current;
    const aprBefore = prevApr.current;
    const now = circ30.hasData ? circ30.rate : null;
    prevRate.current = now;
    prevApr.current = funding.apr;
    if (before === null || now === null || Math.abs(before - now) < 0.05) return;
    setFlashFunding((n) => n + 1);
    const up = now > before;
    toast({
      kind: up ? 'success' : 'info',
      title: t('Circularity {from} → {to}', { from: fmtPct(before), to: fmtPct(now) }),
      body: aprBefore !== null && funding.apr !== null ? t('Estimated APR {from} → {to}', { from: fmtPct(aprBefore, 2), to: fmtPct(funding.apr, 2) }) : undefined,
    });
  }, [circ30.hasData, circ30.rate, funding.apr, toast]);

  // Low stock notifications when a product newly crosses its threshold.
  const prevCritical = useRef<Set<string> | null>(null);
  useEffect(() => {
    const critical = new Set(inventory.filter((r) => r.status === 'critical').map((r) => r.product.id));
    if (prevCritical.current === null) {
      // first run: make sure currently-critical items have a notification
      const existing = new Set(state.notifications.map((n) => n.id));
      for (const r of inventory.filter((x) => x.status === 'critical')) {
        const id = `n_stock_${r.product.id}`;
        if (!existing.has(id) && state.prefs.lowStock)
          patch((s) => ({
            notifications: [
              { id, ref: `stock:${r.product.id}`, kind: 'stock', ...lowStockText(r.product), date: new Date().toISOString(), read: false, to: '/app/products/inventory' },
              ...s.notifications,
            ],
          }));
      }
    } else if (state.prefs.lowStock) {
      for (const id of critical) {
        if (prevCritical.current.has(id)) continue;
        const r = inventory.find((x) => x.product.id === id)!;
        // Skip if an unread alert for this product already exists (e.g. right after loading an account).
        if (state.notifications.some((n) => n.kind === 'stock' && !n.read && (n.ref === `stock:${r.product.id}` || n.title === `Low stock: ${r.product.name}`))) continue;
        pushNotification({ kind: 'stock', ref: `stock:${r.product.id}`, ...lowStockText(r.product), to: '/app/products/inventory' });
      }
    }
    prevCritical.current = critical;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventory]);

  /* ---------------- actions ---------------- */
  const addProduct: AppStore['addProduct'] = useCallback(
    (p) => {
      patch((s) => ({ products: [...s.products, { ...p, id: uid('prd'), circularityScore: materialCircularity(p.materials) }] }));
      toast({ kind: 'success', title: t('Product added'), body: p.name });
    },
    [patch, toast],
  );
  const updateProduct: AppStore['updateProduct'] = useCallback(
    (p) => {
      patch((s) => ({ products: s.products.map((x) => (x.id === p.id ? { ...p, circularityScore: materialCircularity(p.materials) } : x)) }));
      toast({ kind: 'success', title: t('Product updated'), body: p.name });
    },
    [patch, toast],
  );
  const deleteProduct: AppStore['deleteProduct'] = useCallback(
    (id) => {
      patch((s) => ({ products: s.products.filter((x) => x.id !== id) }));
      toast({ kind: 'info', title: t('Product archived') });
    },
    [patch, toast],
  );
  const restock: AppStore['restock'] = useCallback(
    (productId, qty) => {
      const name = state.products.find((x) => x.id === productId)?.name ?? '';
      patch((s) => {
        const p = s.products.find((x) => x.id === productId);
        if (!p) return {};
        return {
          products: s.products.map((x) => (x.id === productId ? { ...x, stockOnHand: x.stockOnHand + qty } : x)),
          transactions: [
            ...s.transactions,
            { id: uid('txn'), type: 'outflow', category: 'Inventory purchase', amount: +(qty * p.unitCost).toFixed(2), productId, quantity: qty, date: toISO(startOfToday()), note: t('Restock {qty} × {name}', { qty, name: p.name }) },
          ],
        };
      });
      toast({ kind: 'success', title: t('Stock received'), body: `${t('+{count} units', { count: qty })} · ${name}` });
    },
    [patch, toast, state.products],
  );
  const addSupplier: AppStore['addSupplier'] = useCallback(
    (sup) => {
      patch((s) => ({ suppliers: [...s.suppliers, { ...sup, id: uid('sup') }] }));
      const score = reliabilityScore(sup);
      toast({ kind: 'success', title: t('Supplier added'), body: score === null ? sup.name : `${sup.name} · ${t('reliability {score}/100', { score })}` });
    },
    [patch, toast],
  );
  const updateSupplier: AppStore['updateSupplier'] = useCallback(
    (sup) => {
      patch((s) => ({ suppliers: s.suppliers.map((x) => (x.id === sup.id ? sup : x)) }));
      toast({ kind: 'success', title: t('Supplier updated'), body: sup.name });
    },
    [patch, toast],
  );
  const addTransaction: AppStore['addTransaction'] = useCallback(
    (x) => {
      patch((s) => {
        const products =
          x.type === 'inflow' && x.productId && x.quantity
            ? s.products.map((p) => (p.id === x.productId ? { ...p, stockOnHand: Math.max(0, p.stockOnHand - x.quantity!) } : p))
            : s.products;
        return { transactions: [...s.transactions, { ...x, id: uid('txn') }], products };
      });
      toast({ kind: 'success', title: t('Transaction logged'), body: `${x.type === 'inflow' ? '+' : '−'}${fmtMoney2(x.amount)} · ${t(x.category)}` });
    },
    [patch, toast],
  );
  const addCustomer: AppStore['addCustomer'] = useCallback(
    (c) => {
      const id = uid('cus');
      patch((s) => ({ customers: [...s.customers, { ...c, id, joinedDate: toISO(startOfToday()) }] }));
      return id;
    },
    [patch],
  );
  const importTransactions: AppStore['importTransactions'] = useCallback(
    (txs, newCustomers, noun = 'transaction') => {
      const used = new Set(txs.map((x) => x.customerId).filter(Boolean));
      patch((s) => ({
        transactions: [...s.transactions, ...txs.map((x) => ({ ...x, id: uid('txn') }))],
        customers: [...s.customers, ...newCustomers.filter((c) => used.has(c.id))],
      }));
      toast({ kind: 'success', title: noun === 'sale' ? t('Imported {count} sales', { count: txs.length }) : t('Imported {count} transactions', { count: txs.length }) });
    },
    [patch, toast],
  );
  const requestFunding: AppStore['requestFunding'] = useCallback(
    (r) => {
      const id = uid('fr');
      patch((s) => ({
        fundingRequests: [{ id, ...r, submittedDate: toISO(startOfToday()), status: 'Pending', apr: r.type === 'Loan' ? funding.apr ?? undefined : undefined }, ...s.fundingRequests],
      }));
      toast({ kind: 'success', title: t('Funding request saved'), body: `${t(r.type)} · ${fmtMoney(r.amount)} · ${t('status {status}', { status: t('Pending') })}` });
    },
    [patch, toast, funding.apr],
  );
  const applyMaterialSwitch: AppStore['applyMaterialSwitch'] = useCallback(
    (productId, materialName) => {
      patch((s) => ({
        products: s.products.map((p) => {
          if (p.id !== productId) return p;
          const materials = p.materials.map((m) => (m.name === materialName ? { ...m, name: m.name.startsWith('Recycled') || m.recycled ? m.name : t('Recycled {material}', { material: m.name.toLowerCase() }), recycled: true } : m));
          return { ...p, materials, circularityScore: materialCircularity(materials) };
        }),
      }));
    },
    [patch],
  );
  const dismissInsight = useCallback((id: string) => patch((s) => ({ dismissedInsights: [...s.dismissedInsights, id] })), [patch]);
  const restoreInsights = useCallback(() => patch({ dismissedInsights: [] }), [patch]);
  const markAllRead = useCallback(() => patch((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })), [patch]);
  const markRead = useCallback((id: string) => patch((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })), [patch]);
  const setProfile = useCallback(
    (profile: BusinessProfile, message?: string) => {
      patch({ profile });
      toast({ kind: 'success', title: message ?? t('Business profile saved') });
    },
    [patch, toast],
  );
  const setPrefs = useCallback((prefs: NotificationPrefs) => patch({ prefs }), [patch]);
  const setRole = useCallback((role: Role) => patch({ role }), [patch]);
  const markFundingSeen = useCallback(
    () => patch({ fundingSeen: { apr: funding.apr, maxEligibility: funding.maxEligibility, rate: circ30.rate } }),
    [patch, funding.apr, funding.maxEligibility, circ30.rate],
  );
  const replaceAll = useCallback((next: Partial<Persisted> | null) => {
    setState(normalizeState(next));
    setMaterialFilter(null);
  }, []);
  const resetData = useCallback(() => {
    setState(defaultState());
    setMaterialFilter(null);
    toast({ kind: 'info', title: t('All data cleared') });
  }, [toast]);

  const value: AppStore = {
    ...state,
    ledger,
    verification,
    circ30,
    circPrev30,
    units90,
    inventory,
    funding,
    recs,
    insights,
    customerStats: stats,
    theme,
    themePref,
    materialFilter,
    filteredProductIds,
    toasts,
    flashFunding,
    setThemePref,
    setRole,
    setMaterialFilter,
    toast,
    dismissToast,
    addProduct,
    updateProduct,
    deleteProduct,
    restock,
    addSupplier,
    updateSupplier,
    addTransaction,
    addCustomer,
    importTransactions,
    requestFunding,
    applyMaterialSwitch,
    dismissInsight,
    restoreInsights,
    markAllRead,
    markRead,
    setProfile,
    setPrefs,
    markFundingSeen,
    resetData,
    replaceAll,
    snapshot: state,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside AppStoreProvider');
  return s;
}
