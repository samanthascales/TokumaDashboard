import {
  ArrowLeftRight,
  Boxes,
  BriefcaseBusiness,
  FileBarChart,
  GraduationCap,
  Landmark,
  LayoutDashboard,
  Package,
  Recycle,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Truck,
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
  { to: '/app/money', label: tk('Money in & out'), icon: ArrowLeftRight },
  {
    to: '/app/products',
    label: tk('Products'),
    icon: Package,
    end: true,
    children: [
      { to: '/app/products/inventory', label: tk('Stock'), icon: Boxes },
      { to: '/app/products/suppliers', label: tk('Suppliers'), icon: Truck },
    ],
  },
  { to: '/app/circularity', label: tk('Circularity'), icon: Recycle },
  { to: '/app/reports', label: tk('Reports'), icon: FileBarChart, badge: 'new' },
  {
    to: '/app/learn',
    label: tk('Learn'),
    icon: GraduationCap,
    end: true,
    children: [{ to: '/app/learn/funding', label: tk('Funding'), icon: Landmark }],
  },
  { to: '/app/settings', label: tk('Settings'), icon: Settings },
];

export const investorNav: NavItem[] = [
  { to: '/app/investor', label: tk('Investor Overview'), icon: BriefcaseBusiness },
  { to: '/app/circularity', label: tk('Circularity Metrics'), icon: Recycle },
  { to: '/app/products/suppliers', label: tk('Suppliers'), icon: Truck, children: [{ to: '/app/supply-chain/reliability', label: tk('Supplier Reliability'), icon: ShieldCheck }] },
  { to: '/app/learn/funding', label: tk('Funding'), icon: Landmark },
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
