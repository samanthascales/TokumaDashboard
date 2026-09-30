export interface Material {
  name: string;
  weightKg: number;
  recycled: boolean;
  reused: boolean;
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
export type MaterialClass = 'Recycled' | 'Reused' | 'Virgin';
