import { useLanguage, translate as tr } from '../../i18n';
import { useNavigate } from 'react-router';
import { useAdminCounters } from '../../api/admin';
import { useLogout, useMe } from '../../api/auth';
import { SidebarShell } from '../../components/layout/SidebarShell';
import type { SidebarItem } from '../../components/layout/SidebarShell';

export function AdminLayout() {
  useLanguage();
  const me = useMe();
  const counters = useAdminCounters();
  const logout = useLogout();
  const navigate = useNavigate();
  const name = me.data?.name ?? 'Administrator';
  const c = counters.data;

  const items: SidebarItem[] = [
    { to: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
    {
      to: '/admin/users',
      label: 'Users',
      icon: '👥',
      end: true,
      badge: c ? { count: c.newUsers24h, tone: 'info' } : undefined,
    },
    { to: '/admin/users/new', label: 'Create User', icon: '➕' },
    {
      to: '/admin/approvals',
      label: 'Approve Users',
      icon: '✅',
      badge: c ? { count: c.pendingUsers, tone: 'warning' } : undefined,
    },
    {
      to: '/admin/transactions',
      label: 'Transactions',
      icon: '💸',
      end: true,
      badge: c ? { count: c.aborted24h, tone: 'warning' } : undefined,
    },
    { to: '/admin/balance-adjustments', label: 'Balance Adjustments', icon: '💰' },
    { to: '/admin/fraud-overview', label: 'Fraud Overview', icon: '📈' },
    {
      to: '/admin/fraud-alerts',
      label: 'Fraud Alerts',
      icon: '🚨',
      badge: c ? { count: c.fraudAlerts, tone: 'fraud' } : undefined,
    },
  ];
  if (c && c.highRisk > 0) {
    items.push({
      to: '/admin/transactions?riskLevel=HIGH',
      label: 'High Risk',
      icon: '🔴',
      badge: { count: c.highRisk, tone: 'fraud' },
    });
  }
  if (c && c.reviewQueue > 0) {
    items.push({
      to: '/admin/transactions?fraud=pending',
      label: 'AI Review Queue',
      icon: '🤖',
      badge: { count: c.reviewQueue, tone: 'plain' },
    });
  }
  items.push({
    to: '/login',
    label: 'Logout',
    icon: '🚪',
    onClick: () =>
      logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) }),
  });

  return (
    <SidebarShell
      brand="🛡️ FraudDetect"
      subtitle={tr('Admin Control Panel')}
      profile={{ initial: name.charAt(0).toUpperCase(), name, role: 'Administrator' }}
      items={items}
      footer={
        <>
          <div>{tr('Fraud Detection System v2.0')}</div>
          <div>{tr('🤖 AI-Powered Fraud Detection')}</div>
        </>
      }
    />
  );
}
