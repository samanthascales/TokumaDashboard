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
import { tk } from '../../i18n';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: 'new';
  children?: NavItem[];
  end?: boolean;
}

export const businessNav: NavItem[] = [
  { to: '/app', label: tk('Dashboard'), icon: LayoutDashboard, end: true },
  {
    to: '/app/products',
    label: tk('Products'),
    icon: Package,
    end: true,
    children: [{ to: '/app/products/inventory', label: tk('Inventory'), icon: Boxes, badge: 'new' }],
  },
  { to: '/app/transactions', label: tk('Transactions'), icon: ArrowLeftRight },
  { to: '/app/circularity', label: tk('Circularity Metrics'), icon: Recycle },
  {
    to: '/app/supply-chain',
    label: tk('Supply Chain'),
    icon: Truck,
    end: true,
    children: [{ to: '/app/supply-chain/reliability', label: tk('Supplier Reliability'), icon: ShieldCheck, badge: 'new' }],
  },
  { to: '/app/funding', label: tk('Funding'), icon: Landmark },
  { to: '/app/customers', label: tk('Customers'), icon: Users },
  { to: '/app/education', label: tk('Education Hub'), icon: GraduationCap },
  { to: '/app/settings', label: tk('Settings'), icon: Settings, badge: 'new' },
];

export const investorNav: NavItem[] = [
  { to: '/app/investor', label: tk('Investor Overview'), icon: BriefcaseBusiness },
  { to: '/app/circularity', label: tk('Circularity Metrics'), icon: Recycle },
  { to: '/app/supply-chain', label: tk('Supply Chain'), icon: Truck, end: true, children: [{ to: '/app/supply-chain/reliability', label: tk('Supplier Reliability'), icon: ShieldCheck }] },
  { to: '/app/funding', label: tk('Funding'), icon: Landmark },
  { to: '/app/settings', label: tk('Settings'), icon: Settings },
];

/** Shown only to accounts listed in the database's admins table. */
export const adminNavItem: NavItem = { to: '/app/admin', label: tk('Admin'), icon: ShieldAlert };

export const allPages = [
  ...businessNav.flatMap((n) => [n, ...(n.children ?? [])]),
  { to: '/app/investor', label: tk('Investor Overview'), icon: BriefcaseBusiness },
];

export const openReport = () => window.dispatchEvent(new CustomEvent('tokuma:report'));
export const openProfile = () => window.dispatchEvent(new CustomEvent('tokuma:profile'));
