import type { BusinessProfile, Customer, FundingRequest, Product, Supplier, Transaction } from '../types';
import { addDays, startOfToday, toISO } from '../lib/format';
import { materialCircularity } from '../lib/metrics';

// Deterministic PRNG so the demo data is stable across reloads.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const seedSuppliers: Supplier[] = [
  {
    id: 'sup_ecofab',
    name: 'EcoFab Textiles',
    country: 'Portugal',
    city: 'Porto',
    transportMethod: 'Road',
    sustainabilityRating: 88,
    carbonEmissionsKg: 1240,
    certifications: ['GOTS', 'GRS', 'OEKO-TEX'],
    materialsSupplied: ['Recycled cotton', 'Organic cotton', 'Recycled polyester thread'],
    avgLeadTimeDays: 12,
    onTimeDeliveryRate: 94,
  },
  {
    id: 'sup_reloop',
    name: 'ReLoop Materials',
    country: 'Netherlands',
    city: 'Rotterdam',
    transportMethod: 'Rail',
    sustainabilityRating: 91,
    carbonEmissionsKg: 860,
    certifications: ['GRS', 'B Corp'],
    materialsSupplied: ['Reclaimed denim', 'Recycled cotton lining'],
    avgLeadTimeDays: 9,
    onTimeDeliveryRate: 97,
  },
  {
    id: 'sup_greenthread',
    name: 'GreenThread Co.',
    country: 'India',
    city: 'Tiruppur',
    transportMethod: 'Sea',
    sustainabilityRating: 72,
    carbonEmissionsKg: 3150,
    certifications: ['GOTS', 'Fair Trade'],
    materialsSupplied: ['Reused canvas', 'Bamboo viscose', 'Recycled nylon', 'Cotton webbing'],
    avgLeadTimeDays: 34,
    onTimeDeliveryRate: 81,
  },
  {
    id: 'sup_hempire',
    name: 'Hempire Supply',
    country: 'Canada',
    city: 'Vancouver',
    transportMethod: 'Rail',
    sustainabilityRating: 79,
    carbonEmissionsKg: 2100,
    certifications: ['OEKO-TEX'],
    materialsSupplied: ['Hemp fleece', 'Recycled polyester'],
    avgLeadTimeDays: 21,
    onTimeDeliveryRate: 86,
  },
  {
    id: 'sup_woolcycle',
    name: 'WoolCycle',
    country: 'New Zealand',
    city: 'Christchurch',
    transportMethod: 'Air',
    sustainabilityRating: 64,
    carbonEmissionsKg: 4980,
    certifications: ['RWS'],
    materialsSupplied: ['Reclaimed wool'],
    avgLeadTimeDays: 28,
    onTimeDeliveryRate: 73,
  },
];

type ProductSeed = Omit<Product, 'circularityScore'> & { dailyUnits: number; winterBias: number };

const productSeeds: ProductSeed[] = [
  {
    id: 'prd_tshirt',
    name: 'Organic Cotton T-Shirt',
    sku: 'TKM-TS-001',
    category: 'Tops',
    price: 32,
    unitCost: 11,
    materials: [
      { name: 'Recycled cotton', weightKg: 0.12, recycled: true, reused: false },
      { name: 'Organic cotton', weightKg: 0.06, recycled: false, reused: false },
      { name: 'Recycled polyester thread', weightKg: 0.01, recycled: true, reused: false },
    ],
    stockOnHand: 38,
    lowStockThreshold: 50,
    safetyStock: 20,
    supplierId: 'sup_ecofab',
    dailyUnits: 4.2,
    winterBias: -0.15,
  },
  {
    id: 'prd_denim',
    name: 'Recycled Denim Jacket',
    sku: 'TKM-OW-014',
    category: 'Outerwear',
    price: 89,
    unitCost: 34,
    materials: [
      { name: 'Reclaimed denim', weightKg: 0.65, recycled: false, reused: true },
      { name: 'Recycled cotton lining', weightKg: 0.15, recycled: true, reused: false },
      { name: 'Metal buttons', weightKg: 0.04, recycled: false, reused: false },
    ],
    stockOnHand: 64,
    lowStockThreshold: 15,
    safetyStock: 6,
    supplierId: 'sup_reloop',
    dailyUnits: 0.9,
    winterBias: 0.25,
  },
  {
    id: 'prd_tote',
    name: 'Upcycled Canvas Tote',
    sku: 'TKM-AC-007',
    category: 'Accessories',
    price: 24,
    unitCost: 6,
    materials: [
      { name: 'Reused canvas', weightKg: 0.3, recycled: false, reused: true },
      { name: 'Cotton webbing', weightKg: 0.05, recycled: false, reused: false },
    ],
    stockOnHand: 142,
    lowStockThreshold: 30,
    safetyStock: 20,
    supplierId: 'sup_greenthread',
    dailyUnits: 2.2,
    winterBias: -0.1,
  },
  {
    id: 'prd_hoodie',
    name: 'Hemp Blend Hoodie',
    sku: 'TKM-TP-022',
    category: 'Tops',
    price: 68,
    unitCost: 24,
    materials: [
      { name: 'Hemp fleece', weightKg: 0.55, recycled: false, reused: false },
      { name: 'Recycled polyester', weightKg: 0.2, recycled: true, reused: false },
    ],
    stockOnHand: 36,
    lowStockThreshold: 15,
    safetyStock: 10,
    supplierId: 'sup_hempire',
    dailyUnits: 1.4,
    winterBias: 0.45,
  },
  {
    id: 'prd_beanie',
    name: 'Reclaimed Wool Beanie',
    sku: 'TKM-AC-031',
    category: 'Accessories',
    price: 28,
    unitCost: 8,
    materials: [{ name: 'Reclaimed wool', weightKg: 0.09, recycled: false, reused: true }],
    stockOnHand: 96,
    lowStockThreshold: 20,
    safetyStock: 12,
    supplierId: 'sup_woolcycle',
    dailyUnits: 1.1,
    winterBias: 0.9,
  },
  {
    id: 'prd_socks',
    name: 'Bamboo Crew Socks',
    sku: 'TKM-AC-040',
    category: 'Accessories',
    price: 14,
    unitCost: 3.5,
    materials: [
      { name: 'Bamboo viscose', weightKg: 0.06, recycled: false, reused: false },
      { name: 'Recycled nylon', weightKg: 0.02, recycled: true, reused: false },
    ],
    stockOnHand: 260,
    lowStockThreshold: 60,
    safetyStock: 40,
    supplierId: 'sup_greenthread',
    dailyUnits: 3.5,
    winterBias: 0.1,
  },
];

export const seedProducts: Product[] = productSeeds.map(({ dailyUnits: _d, winterBias: _w, ...p }) => ({
  ...p,
  circularityScore: materialCircularity(p.materials),
}));

const firstNames = ['Maya', 'Leo', 'Aisha', 'Noah', 'Priya', 'Mateo', 'Hana', 'Oliver', 'Zara', 'Ethan', 'Chloe', 'Kofi', 'Lena', 'Ravi', 'Sofia', 'Jonas', 'Amara', 'Lucas', 'Ines', 'Theo', 'Yuki', 'Sam', 'Nadia', 'Felix', 'Grace', 'Omar', 'Elena', 'Kai', 'Freya', 'Diego', 'Iris', 'Marcus', 'Leila', 'Arjun', 'Nora', 'Hugo'];
const lastNames = ['Chen', 'Okafor', 'Rossi', 'Patel', 'Larsen', 'García', 'Kim', 'Dubois', 'Nguyen', 'Müller', 'Silva', 'Haddad', 'Novak', 'Tanaka', 'Mensah', 'Byrne', 'Ivanova', 'Costa'];
const cities = ['Toronto', 'Montréal', 'Vancouver', 'Calgary', 'Ottawa', 'Halifax', 'Winnipeg', 'Victoria'];

export function generateSeed() {
  const rand = mulberry32(20240917);
  const today = startOfToday();
  const DAYS = 760;
  const start = addDays(today, -DAYS);

  // Customers with activity windows so we get New / Repeat / At-risk segments.
  const customers: (Customer & { weight: number; from: number; to: number })[] = firstNames.map((fn, i) => {
    const ln = lastNames[i % lastNames.length]!;
    const r = rand();
    let from = Math.floor(rand() * DAYS * 0.6);
    let to = DAYS;
    if (r < 0.2) {
      // churned / at-risk: stopped ordering 3–8 months ago
      to = DAYS - 100 - Math.floor(rand() * 200);
      from = Math.min(from, to - 60);
    } else if (r < 0.35) {
      // new: joined in the last ~7 weeks
      from = DAYS - 10 - Math.floor(rand() * 40);
    }
    return {
      id: `cus_${i + 1}`,
      name: `${fn} ${ln}`,
      email: `${fn.toLowerCase()}.${ln.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}@${['gmail.com', 'outlook.com', 'proton.me', 'hey.com'][i % 4]}`,
      city: cities[i % cities.length]!,
      joinedDate: toISO(addDays(start, Math.max(0, from))),
      weight: 0.3 + Math.pow(rand(), 2) * 3,
      from: Math.max(0, from),
      to,
    };
  });

  // Seasonality multipliers by month (Jan..Dec) — holiday peak + a summer bump.
  const season = [0.78, 0.7, 0.82, 0.9, 1.0, 1.08, 1.14, 1.02, 0.96, 1.08, 1.42, 1.72];
  const winter = [0.8, 0.6, 0.3, 0, -0.3, -0.6, -0.7, -0.5, -0.1, 0.3, 0.7, 0.9];

  const txs: Transaction[] = [];
  let n = 0;
  const id = () => `txn_${(++n).toString().padStart(5, '0')}`;

  for (let d = 0; d <= DAYS; d++) {
    const date = addDays(start, d);
    const iso = toISO(date);
    const m = date.getMonth();
    const growth = 0.72 + (d / DAYS) * 0.4;
    const weekday = date.getDay();
    const weekendBoost = weekday === 0 || weekday === 6 ? 1.15 : 1;

    const active = customers.filter((c) => d >= c.from && d <= c.to);
    const totalW = active.reduce((s, c) => s + c.weight, 0);
    const pickCustomer = () => {
      let x = rand() * totalW;
      for (const c of active) {
        x -= c.weight;
        if (x <= 0) return c.id;
      }
      return active[active.length - 1]?.id;
    };

    let dayRevenue = 0;
    for (const p of productSeeds) {
      const expected = p.dailyUnits * season[m]! * growth * weekendBoost * Math.max(0.15, 1 + p.winterBias * winter[m]!);
      // split into orders of 1–3 units
      let units = Math.round(expected * (0.55 + rand() * 0.9));
      while (units > 0) {
        const q = Math.min(units, 1 + Math.floor(rand() * 3));
        units -= q;
        const amount = +(q * p.price).toFixed(2);
        dayRevenue += amount;
        txs.push({
          id: id(),
          type: 'inflow',
          category: 'Product sale',
          amount,
          productId: p.id,
          customerId: active.length ? pickCustomer() : undefined,
          quantity: q,
          date: iso,
        });
      }
    }

    // Materials purchase ~ weekly, proportional to recent revenue
    if (weekday === 1) {
      txs.push({ id: id(), type: 'outflow', category: 'Materials', amount: +(dayRevenue * 7 * (0.28 + rand() * 0.06)).toFixed(2), date: iso, note: 'Weekly materials order' });
      txs.push({ id: id(), type: 'outflow', category: 'Logistics', amount: +(dayRevenue * 7 * (0.05 + rand() * 0.02)).toFixed(2), date: iso, note: 'Outbound shipping' });
    }
    if (date.getDate() === 1) {
      txs.push({ id: id(), type: 'outflow', category: 'Payroll', amount: 3200 + Math.round(d * 1.2), date: iso });
      txs.push({ id: id(), type: 'outflow', category: 'Rent & utilities', amount: 1250, date: iso });
    }
    if (date.getDate() === 15) {
      txs.push({ id: id(), type: 'outflow', category: 'Marketing', amount: Math.round((450 + rand() * 300) * (m >= 9 ? 1.6 : 1)), date: iso });
      txs.push({ id: id(), type: 'outflow', category: 'Packaging', amount: Math.round(180 + rand() * 120), date: iso });
    }
    if (d === Math.round(DAYS * 0.45)) {
      txs.push({ id: id(), type: 'inflow', category: 'Grant', amount: 10000, date: iso, note: 'Circular Economy Innovation Grant' });
    }
  }

  const cleanCustomers: Customer[] = customers.map(({ weight: _w, from: _f, to: _t, ...c }) => c);

  const fundingRequests: FundingRequest[] = [
    { id: 'fr_1', type: 'Loan', amount: 25000, purpose: 'Recycled fibre inventory expansion', submittedDate: toISO(addDays(today, -262)), status: 'Funded', apr: 7.4 },
    { id: 'fr_2', type: 'Grant', amount: 10000, purpose: 'Take-back programme pilot', submittedDate: toISO(addDays(today, -230)), status: 'Funded' },
    { id: 'fr_3', type: 'Reward', amount: 6000, purpose: 'Community pre-order: denim restock', submittedDate: toISO(addDays(today, -41)), status: 'Approved' },
    { id: 'fr_4', type: 'Equity', amount: 50000, purpose: 'Repair & resale studio build-out', submittedDate: toISO(addDays(today, -6)), status: 'Pending' },
  ];

  return { transactions: txs, customers: cleanCustomers, fundingRequests };
}

export const seedProfile: BusinessProfile = {
  ownerName: 'Alex Rivera',
  email: 'hello@threadloop.co',
  role: 'Founder & CEO',
  businessName: 'ThreadLoop Apparel',
  industry: 'Apparel & Textiles',
  country: 'Canada',
  founded: '2021',
  description: 'Circular streetwear made from recycled and reclaimed fibres, with a take-back programme for every garment.',
  website: 'threadloop.co',
  employees: '6–10',
  primaryMaterials: ['Recycled cotton', 'Reclaimed denim', 'Hemp'],
  circularModel: 'Recycled inputs + take-back',
  annualRevenue: '$100k–$250k',
  fundingGoal: '50000',
  bankConnected: true,
};
