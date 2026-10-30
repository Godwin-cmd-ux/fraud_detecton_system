import {
  Activity,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpRight,
  Bot,
  ChartNoAxesCombined,
  Check,
  CircleAlert,
  Clock3,
  Inbox,
  LayoutDashboard,
  LogOut,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';

const icons: Record<string, typeof Activity> = {
  // Navigation labels
  Dashboard: LayoutDashboard,
  Users,
  'Create User': UserPlus,
  'Approve Users': Check,
  Transactions: ArrowLeftRight,
  'Balance Adjustments': Wallet,
  'Fraud Overview': ChartNoAxesCombined,
  'Fraud Alerts': ShieldCheck,
  'High Risk': CircleAlert,
  'AI Review Queue': Clock3,
  Logout: LogOut,
  'Send Money': ArrowUpRight,
  Withdraw: ArrowDownToLine,
  // Named icons for stat cards and empty states
  activity: ArrowLeftRight,
  users: Users,
  transfer: ArrowUpRight,
  success: Check,
  failed: X,
  trend: ChartNoAxesCombined,
  wallet: Wallet,
  inbox: Inbox,
  fraud: ShieldAlert,
  risk: CircleAlert,
  queue: Bot,
};

/** Consistent line icons for navigation labels and named display slots. */
export function DisplayIcon({ value, size = 20 }: { value: string; size?: number }) {
  const Icon = icons[value] ?? Activity;
  return <Icon size={size} strokeWidth={1.75} aria-hidden="true" />;
}
