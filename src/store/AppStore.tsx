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
import { generateSeed, seedProducts, seedProfile, seedSuppliers } from '../data/seed';
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
  totalsFor,
  type CircularityStats,
  type FundingTerms,
  type InventoryRow,
  type Ledger,
  type Recommendation,
} from '../lib/metrics';
import { fmtPct, startOfToday, toISO, uid } from '../lib/format';
import type { CustomerStats, Insight } from '../types';

export interface Toast {
  id: string;
  kind: 'success' | 'info' | 'error';
  title: string;
  body?: string;
}

interface Persisted {
  products: Product[];
  suppliers: Supplier[];
  extraTransactions: Transaction[];
  extraCustomers: Customer[];
  fundingRequests: FundingRequest[];
  profile: BusinessProfile;
  prefs: NotificationPrefs;
  role: Role;
  dismissedInsights: string[];
  notifications: AppNotification[];
  fundingSeen: { apr: number; maxEligibility: number; rate: number } | null;
}

const STORAGE_KEY = 'tokuma-state-v1';
const seed = generateSeed();

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 3_600_000).toISOString();
}

function defaultState(): Persisted {
  return {
    products: seedProducts,
    suppliers: seedSuppliers,
    extraTransactions: [],
    extraCustomers: [],
    fundingRequests: seed.fundingRequests,
    profile: seedProfile,
    prefs: { lowStock: true, funding: true, supplier: true, insights: true, weeklyDigest: false },
    role: 'business',
    dismissedInsights: [],
    notifications: [
      { id: 'n_1', kind: 'funding', title: 'Reward campaign approved', body: 'Community pre-order: denim restock was approved for $6,000.', date: hoursAgo(5), read: false, to: '/app/funding' },
      { id: 'n_2', kind: 'supplier', title: 'WoolCycle shipment delayed', body: 'PO #1182 is running 4 days late. Lead-time average updated.', date: hoursAgo(26), read: false, to: '/app/supply-chain/reliability' },
      { id: 'n_3', kind: 'insight', title: 'New circular insight', body: 'Switching hemp fleece to recycled could lift circularity by ~8%.', date: hoursAgo(50), read: true, to: '/app' },
      { id: 'n_4', kind: 'system', title: 'Bank sync complete', body: '312 transactions categorised automatically.', date: hoursAgo(80), read: true, to: '/app/transactions' },
    ],
    fundingSeen: null,
  };
}

function loadState(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultState(), ...(JSON.parse(raw) as Partial<Persisted>) };
  } catch {
    /* storage unavailable */
  }
  return defaultState();
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
  transactions: Transaction[];
  customers: Customer[];
  ledger: Ledger;
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
  requestFunding: (r: { type: FundingType; amount: number; purpose: string }) => void;
  applyMaterialSwitch: (productId: string, materialName: string) => void;
  dismissInsight: (id: string) => void;
  restoreInsights: () => void;
  markAllRead: () => void;
  markRead: (id: string) => void;
  setProfile: (p: BusinessProfile) => void;
  setPrefs: (p: NotificationPrefs) => void;
  markFundingSeen: () => void;
  resetDemo: () => void;
}

const Ctx = createContext<AppStore | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>(loadState);
  const [themePref, setThemePrefState] = useState<ThemePref>(loadThemePref);
  const [systemDark, setSystemDark] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const theme: 'light' | 'dark' = themePref === 'system' ? (systemDark ? 'dark' : 'light') : themePref;
  const [materialFilter, setMaterialFilter] = useState<MaterialClass | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [flashFunding, setFlashFunding] = useState(0);

  const patch = useCallback((p: Partial<Persisted> | ((s: Persisted) => Partial<Persisted>)) => {
    setState((s) => ({ ...s, ...(typeof p === 'function' ? p(s) : p) }));
  }, []);

  // Persist
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore quota / private mode */
    }
  }, [state]);

  // Theme
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const h = () => setSystemDark(mq.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
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
  const transactions = useMemo(() => [...seed.transactions, ...state.extraTransactions], [state.extraTransactions]);
  const customers = useMemo(() => [...seed.customers, ...state.extraCustomers], [state.extraCustomers]);
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
    const avgSust = state.suppliers.length ? state.suppliers.reduce((s, x) => s + x.sustainabilityRating, 0) / state.suppliers.length : 50;
    return fundingTerms(circ30.rate, yr.revenue, avgSust, yr.revenue ? yr.profit / yr.revenue : 0);
  }, [ledger, state.suppliers, circ30.rate]);
  const recs = useMemo(() => recommendations(state.products, units90), [state.products, units90]);
  const peakLift = useMemo(() => seasonalPeakLift(ledger), [ledger]);
  const insights = useMemo(
    () =>
      generateInsights({ inventory, suppliers: state.suppliers, recs, funding, customers: stats, peakLift }).filter(
        (i) => !state.dismissedInsights.includes(i.id),
      ),
    [inventory, state.suppliers, recs, funding, stats, peakLift, state.dismissedInsights],
  );
  const filteredProductIds = useMemo(() => {
    if (!materialFilter) return null;
    return new Set(state.products.filter((p) => p.materials.some((m) => classifyMaterial(m) === materialFilter)).map((p) => p.id));
  }, [materialFilter, state.products]);

  // Celebrate circularity changes so the "data unlocks capital" link is felt app-wide.
  const prevRate = useRef(circ30.rate);
  const prevApr = useRef(funding.apr);
  useEffect(() => {
    const before = prevRate.current;
    const aprBefore = prevApr.current;
    prevRate.current = circ30.rate;
    prevApr.current = funding.apr;
    if (Math.abs(before - circ30.rate) < 0.05) return;
    setFlashFunding((n) => n + 1);
    const up = circ30.rate > before;
    toast({
      kind: up ? 'success' : 'info',
      title: `Circularity ${fmtPct(before)} → ${fmtPct(circ30.rate)}`,
      body: `Estimated APR ${up ? 'improved' : 'changed'} ${aprBefore.toFixed(2)}% → ${funding.apr.toFixed(2)}%`,
    });
  }, [circ30.rate, funding.apr, toast]);

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
              { id, kind: 'stock', title: `Low stock: ${r.product.name}`, body: `${r.product.stockOnHand} units left (threshold ${r.product.lowStockThreshold}).`, date: new Date().toISOString(), read: false, to: '/app/products/inventory' },
              ...s.notifications,
            ],
          }));
      }
    } else if (state.prefs.lowStock) {
      for (const id of critical) {
        if (prevCritical.current.has(id)) continue;
        const r = inventory.find((x) => x.product.id === id)!;
        pushNotification({ kind: 'stock', title: `Low stock: ${r.product.name}`, body: `${r.product.stockOnHand} units left (threshold ${r.product.lowStockThreshold}).`, to: '/app/products/inventory' });
      }
    }
    prevCritical.current = critical;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventory]);

  /* ---------------- actions ---------------- */
  const addProduct: AppStore['addProduct'] = useCallback(
    (p) => {
      patch((s) => ({ products: [...s.products, { ...p, id: uid('prd'), circularityScore: materialCircularity(p.materials) }] }));
      toast({ kind: 'success', title: 'Product added', body: p.name });
    },
    [patch, toast],
  );
  const updateProduct: AppStore['updateProduct'] = useCallback(
    (p) => {
      patch((s) => ({ products: s.products.map((x) => (x.id === p.id ? { ...p, circularityScore: materialCircularity(p.materials) } : x)) }));
      toast({ kind: 'success', title: 'Product updated', body: p.name });
    },
    [patch, toast],
  );
  const deleteProduct: AppStore['deleteProduct'] = useCallback(
    (id) => {
      patch((s) => ({ products: s.products.filter((x) => x.id !== id) }));
      toast({ kind: 'info', title: 'Product archived' });
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
          extraTransactions: [
            ...s.extraTransactions,
            { id: uid('txn'), type: 'outflow', category: 'Inventory purchase', amount: +(qty * p.unitCost).toFixed(2), productId, quantity: qty, date: toISO(startOfToday()), note: `Restock ${qty} × ${p.name}` },
          ],
        };
      });
      toast({ kind: 'success', title: 'Stock received', body: `+${qty} units · ${name}` });
    },
    [patch, toast, state.products],
  );
  const addSupplier: AppStore['addSupplier'] = useCallback(
    (sup) => {
      patch((s) => ({ suppliers: [...s.suppliers, { ...sup, id: uid('sup') }] }));
      toast({ kind: 'success', title: 'Supplier added', body: `${sup.name} · reliability ${reliabilityScore(sup)}/100` });
    },
    [patch, toast],
  );
  const updateSupplier: AppStore['updateSupplier'] = useCallback(
    (sup) => {
      patch((s) => ({ suppliers: s.suppliers.map((x) => (x.id === sup.id ? sup : x)) }));
      toast({ kind: 'success', title: 'Supplier updated', body: sup.name });
    },
    [patch, toast],
  );
  const addTransaction: AppStore['addTransaction'] = useCallback(
    (t) => {
      patch((s) => {
        const products =
          t.type === 'inflow' && t.productId && t.quantity
            ? s.products.map((p) => (p.id === t.productId ? { ...p, stockOnHand: Math.max(0, p.stockOnHand - t.quantity!) } : p))
            : s.products;
        return { extraTransactions: [...s.extraTransactions, { ...t, id: uid('txn') }], products };
      });
      toast({ kind: 'success', title: 'Transaction logged', body: `${t.type === 'inflow' ? '+' : '−'}$${t.amount.toFixed(2)} · ${t.category}` });
    },
    [patch, toast],
  );
  const addCustomer: AppStore['addCustomer'] = useCallback(
    (c) => {
      const id = uid('cus');
      patch((s) => ({ extraCustomers: [...s.extraCustomers, { ...c, id, joinedDate: toISO(startOfToday()) }] }));
      return id;
    },
    [patch],
  );
  const requestFunding: AppStore['requestFunding'] = useCallback(
    (r) => {
      const id = uid('fr');
      patch((s) => ({
        fundingRequests: [{ id, ...r, submittedDate: toISO(startOfToday()), status: 'Pending', apr: r.type === 'Loan' ? funding.apr : undefined }, ...s.fundingRequests],
      }));
      toast({ kind: 'success', title: 'Funding request submitted', body: `${r.type} · $${r.amount.toLocaleString()}` });
      // Simulate a lender decision arriving later.
      setTimeout(() => {
        patch((s) => ({ fundingRequests: s.fundingRequests.map((x) => (x.id === id && x.status === 'Pending' ? { ...x, status: 'Approved' } : x)) }));
        pushNotification({ kind: 'funding', title: `${r.type} request approved`, body: `$${r.amount.toLocaleString()} for “${r.purpose}” was approved.`, to: '/app/funding' });
      }, 20000);
    },
    [patch, toast, funding.apr, pushNotification],
  );
  const applyMaterialSwitch: AppStore['applyMaterialSwitch'] = useCallback(
    (productId, materialName) => {
      patch((s) => ({
        products: s.products.map((p) => {
          if (p.id !== productId) return p;
          const materials = p.materials.map((m) => (m.name === materialName ? { ...m, name: m.name.startsWith('Recycled') ? m.name : `Recycled ${m.name.toLowerCase()}`, recycled: true } : m));
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
    (profile: BusinessProfile) => {
      patch({ profile });
      toast({ kind: 'success', title: 'Business profile saved' });
    },
    [patch, toast],
  );
  const setPrefs = useCallback((prefs: NotificationPrefs) => patch({ prefs }), [patch]);
  const setRole = useCallback((role: Role) => patch({ role }), [patch]);
  const markFundingSeen = useCallback(
    () => patch({ fundingSeen: { apr: funding.apr, maxEligibility: funding.maxEligibility, rate: circ30.rate } }),
    [patch, funding.apr, funding.maxEligibility, circ30.rate],
  );
  const resetDemo = useCallback(() => {
    setState(defaultState());
    setMaterialFilter(null);
    toast({ kind: 'info', title: 'Demo data reset' });
  }, [toast]);

  const value: AppStore = {
    ...state,
    transactions,
    customers,
    ledger,
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
    requestFunding,
    applyMaterialSwitch,
    dismissInsight,
    restoreInsights,
    markAllRead,
    markRead,
    setProfile,
    setPrefs,
    markFundingSeen,
    resetDemo,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside AppStoreProvider');
  return s;
}
