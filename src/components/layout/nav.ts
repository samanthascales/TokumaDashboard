import {
  ArrowLeftRight,
  Boxes,
  BriefcaseBusiness,
  GraduationCap,
  Landmark,
  LayoutDashboard,
  Package,
  Recycle,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: 'new';
  children?: NavItem[];
  end?: boolean;
}

export const businessNav: NavItem[] = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  {
    to: '/app/products',
    label: 'Products',
    icon: Package,
    end: true,
    children: [{ to: '/app/products/inventory', label: 'Inventory', icon: Boxes, badge: 'new' }],
  },
  { to: '/app/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/app/circularity', label: 'Circularity Metrics', icon: Recycle },
  {
    to: '/app/supply-chain',
    label: 'Supply Chain',
    icon: Truck,
    end: true,
    children: [{ to: '/app/supply-chain/reliability', label: 'Supplier Reliability', icon: ShieldCheck, badge: 'new' }],
  },
  { to: '/app/funding', label: 'Funding', icon: Landmark },
  { to: '/app/customers', label: 'Customers', icon: Users },
  { to: '/app/education', label: 'Education Hub', icon: GraduationCap },
  { to: '/app/settings', label: 'Settings', icon: Settings, badge: 'new' },
];

export const investorNav: NavItem[] = [
  { to: '/app/investor', label: 'Investor Overview', icon: BriefcaseBusiness },
  { to: '/app/circularity', label: 'Circularity Metrics', icon: Recycle },
  { to: '/app/supply-chain', label: 'Supply Chain', icon: Truck, end: true, children: [{ to: '/app/supply-chain/reliability', label: 'Supplier Reliability', icon: ShieldCheck }] },
  { to: '/app/funding', label: 'Funding', icon: Landmark },
  { to: '/app/settings', label: 'Settings', icon: Settings },
];

/** Shown only to accounts listed in the database's admins table. */
export const adminNavItem: NavItem = { to: '/app/admin', label: 'Admin', icon: ShieldAlert };

export const allPages = [
  ...businessNav.flatMap((n) => [n, ...(n.children ?? [])]),
  { to: '/app/investor', label: 'Investor Overview', icon: BriefcaseBusiness },
];

export const openReport = () => window.dispatchEvent(new CustomEvent('tokuma:report'));
