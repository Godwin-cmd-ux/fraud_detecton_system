import {
  Activity,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpRight,
  ChartNoAxesCombined,
  Check,
  CircleAlert,
  Clock3,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';

/** Consistent line icons for existing display values and navigation labels. */
export function DisplayIcon({ value, size = 20 }: { value: string; size?: number }) {
  const icons: Record<string, typeof Activity> = {
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
    '📊': ArrowLeftRight,
    '👥': Users,
    '💸': ArrowUpRight,
    '✅': Check,
    '❌': X,
    '📈': ChartNoAxesCombined,
    '💰': Wallet,
    '📭': ArrowLeftRight,
  };
  const Icon = icons[value] ?? Activity;
  return <Icon size={size} strokeWidth={1.7} aria-hidden="true" />;
}
