export interface Material {
  name: string;
  weightKg: number;
  recycled: boolean;
  reused: boolean;
  /** Sustainably sourced renewable material (e.g. certified organic or FSC). Counts as circular inflow. */
  renewable?: boolean;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  unitCost: number;
  materials: Material[];
  /** 0-100, derived from materials (share of circular weight). */
  circularityScore: number;
  stockOnHand: number; // Focus 4
  lowStockThreshold: number; // Focus 4
  safetyStock: number; // Focus 4 — used in reorderPoint
  supplierId?: string; // links to Supplier for lead time
  /** How many years the product lasts, and how long a typical similar product lasts. null until entered. */
  lifetimeYears?: number | null;
  typicalLifetimeYears?: number | null;
  /** How intensively it is used compared with a typical product: 1 = normal, 2 = e.g. shared or rented. */
  useIntensity?: number | null;
}

export interface Supplier {
  id: string;
  name: string;
  country: string;
  city: string;
  transportMethod: TransportMethod;
  // Measured values are null until the business enters them — never guessed.
  sustainabilityRating: number | null; // 0-100
  carbonEmissionsKg: number | null;
  certifications: string[];
  materialsSupplied: string[];
  avgLeadTimeDays: number | null; // Focus 5
  onTimeDeliveryRate: number | null; // Focus 5, 0-100
}

export type TransportMethod = 'Sea' | 'Rail' | 'Road' | 'Air';

export interface Transaction {
  id: string;
  type: 'inflow' | 'outflow';
  category: string;
  amount: number;
  productId?: string; // Focus 1 — links sale to product
  customerId?: string;
  quantity?: number;
  date: string; // ISO yyyy-mm-dd
  note?: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  city: string;
  joinedDate: string;
}

/** Customer enriched with values derived from transactions. */
export interface CustomerStats extends Customer {
  totalSpent: number;
  lastOrderDate: string | null;
  orders: number;
  productsPurchased: string[];
  segment: 'New' | 'Repeat' | 'At-risk';
  avgOrderValue: number;
}

export type FundingType = 'Loan' | 'Grant' | 'Equity' | 'Reward';
export type FundingStatus = 'Pending' | 'Approved' | 'Funded' | 'Declined';

export interface FundingRequest {
  id: string;
  type: FundingType;
  amount: number;
  purpose: string;
  submittedDate: string;
  status: FundingStatus;
  apr?: number;
}

export type InsightKind = 'optimization' | 'alert' | 'opportunity';

export interface Insight {
  id: string;
  kind: InsightKind;
  title: string;
  body: string;
  impact: string;
  confidence: 'High' | 'Medium' | 'Low';
  actionLabel: string;
  /** Either a route to navigate to, or an in-app action key. */
  action: { type: 'navigate'; to: string } | { type: 'apply-material'; productId: string; materialName: string };
}

export interface AppNotification {
  id: string;
  kind: 'stock' | 'funding' | 'supplier' | 'insight' | 'system';
  title: string;
  body: string;
  date: string; // ISO datetime
  read: boolean;
  to?: string;
  /** What the notification is about (e.g. `stock:<productId>`), for de-duplicating. */
  ref?: string;
}

export interface BusinessProfile {
  ownerName: string;
  email: string;
  role: string;
  /** Profile photo as a small JPEG data URL (resized in the browser), or '' for initials. */
  avatar: string;
  phone: string;
  businessName: string;
  industry: string;
  country: string;
  founded: string;
  description: string;
  website: string;
  employees: string;
  primaryMaterials: string[];
  circularModel: string;
  annualRevenue: string;
  fundingGoal: string;
  bankConnected: boolean;
}

export interface NotificationPrefs {
  lowStock: boolean;
  funding: boolean;
  supplier: boolean;
  insights: boolean;
  weeklyDigest: boolean;
}

export type Role = 'business' | 'investor';
export type ThemePref = 'light' | 'dark' | 'system';
export type MaterialClass = 'Recycled' | 'Reused' | 'Renewable' | 'Virgin';

/** Something the business owns besides cash and stock (equipment, a van…), for the balance sheet. */
export interface Asset {
  id: string;
  name: string;
  kind: 'Equipment' | 'Vehicle' | 'Property' | 'Other';
  value: number;
}

/** Something the business owes (a loan, an unpaid bill…), for the balance sheet. */
export interface Liability {
  id: string;
  name: string;
  kind: 'Loan' | 'Unpaid bill' | 'Credit card' | 'Other';
  amount: number;
}

/* ---------------- Education program ---------------- */

export type ModuleId = 'sustainability' | 'operations' | 'finance' | 'impact';
export type DeliverableKind = 'statement' | 'wasteLog' | 'financialSnapshot' | 'kpi';

export interface WasteLogEntry {
  date: string; // ISO yyyy-mm-dd
  material: string;
  inKg: number | null;
  outKg: number | null;
  /** What happened to the output: reused, recycled, thrown away… in the owner's words. */
  fate: string;
}

/** A module's milestone deliverable, entered in the platform. `date` is when it was last saved. */
export type Deliverable =
  | { kind: 'statement'; text: string; date: string }
  | { kind: 'wasteLog'; entries: WasteLogEntry[]; date: string }
  | { kind: 'financialSnapshot'; period: string; revenue: number | null; costs: number | null; date: string }
  | { kind: 'kpi'; name: string; unit: string; baseline: number | null; target: number | null; date: string };

export interface QuizResult {
  correct: number;
  total: number;
  date: string; // ISO datetime
}

export interface ModuleProgress {
  lessonsDone: string[];
  /** Latest checkpoint attempt; null until taken. Pre-tested modules use the diagnostic instead. */
  checkpoint: QuizResult | null;
  deliverable: Deliverable | null;
}

/** What the business has done in the education program. Statuses and scores are calculated from this, never stored. */
export interface EducationProgress {
  diagnostic: {
    startedAt: string | null; // ISO datetime; the timer runs from here
    answers: Record<string, number>;
    submittedAt: string | null;
  };
  modules: Record<ModuleId, ModuleProgress>;
}

/** Targets the owner sets; null until they choose one. */
export interface Goals {
  monthlyProfit: number | null;
  circularityScore: number | null;
}

/** Where waste or returned products went, from the top of the R-ladder (keeps the most value) to the bottom. */
export type RecoveryRoute = 'Reuse or repair' | 'Refurbish or remanufacture' | 'Recycle or compost' | 'Energy recovery' | 'Landfill or incineration';

/** One record of production waste or returned products and what happened to it. */
export interface WasteEntry {
  id: string;
  date: string; // ISO yyyy-mm-dd
  description: string;
  kg: number;
  route: RecoveryRoute;
}
