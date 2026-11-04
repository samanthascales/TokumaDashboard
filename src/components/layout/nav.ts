import {
  ArrowLeftRight,
  Boxes,
  BriefcaseBusiness,
  FileBarChart,
  Share2,
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
  /** A small heading shown above this item, starting a new section of the menu. */
  section?: string;
  children?: NavItem[];
  end?: boolean;
}

// One flat list in three labelled sections: sub-pages (Inventory, Suppliers, the
// report tabs) are tabs inside their page, so nothing appears twice.
export const businessNav: NavItem[] = [
  { to: '/app', label: tk('Dashboard'), icon: LayoutDashboard, end: true, section: tk('Run your business') },
  { to: '/app/money', label: tk('Revenue & expenses'), icon: ArrowLeftRight },
  { to: '/app/products', label: tk('Products'), icon: Package },
  { to: '/app/circularity', label: tk('Circularity'), icon: Recycle, section: tk('Your impact') },
  { to: '/app/reports', label: tk('Reports'), icon: FileBarChart, section: tk('Grow') },
  { to: '/app/learn/funding', label: tk('Funding'), icon: Landmark },
  { to: '/app/learn', label: tk('Learn'), icon: GraduationCap, end: true },
  { to: '/app/settings', label: tk('Settings'), icon: Settings, section: tk('Account') },
];

/** Pages that are reached from inside another page; listed so search still finds them. */
const subPages: NavItem[] = [
  { to: '/app/products/inventory', label: tk('Inventory'), icon: Boxes },
  { to: '/app/products/suppliers', label: tk('Suppliers'), icon: Truck },
  { to: '/app/share', label: tk('Share a report'), icon: Share2 },
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
  ...businessNav,
  ...subPages,
  { to: '/app/investor', label: tk('Investor Overview'), icon: BriefcaseBusiness },
];

export const openProfile = () => window.dispatchEvent(new CustomEvent('tokuma:profile'));
