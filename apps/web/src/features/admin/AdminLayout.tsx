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
    { to: '/admin/dashboard', label: 'Dashboard', section: 'Overview' },
    {
      to: '/admin/users',
      label: 'Users',
      section: 'People',
      end: true,
      badge: c ? { count: c.newUsers24h, tone: 'info' } : undefined,
    },
    { to: '/admin/users/new', label: 'Create User', section: 'People' },
    {
      to: '/admin/approvals',
      label: 'Approve Users',
      section: 'People',
      badge: c ? { count: c.pendingUsers, tone: 'warning' } : undefined,
    },
    {
      to: '/admin/transactions',
      label: 'Transactions',
      section: 'Money',
      end: true,
      badge: c ? { count: c.aborted24h, tone: 'warning' } : undefined,
    },
    { to: '/admin/balance-adjustments', label: 'Balance Adjustments', section: 'Money' },
    { to: '/admin/fraud-overview', label: 'Fraud Overview', section: 'Risk' },
    {
      to: '/admin/fraud-alerts',
      label: 'Fraud Alerts',
      section: 'Risk',
      badge: c ? { count: c.fraudAlerts, tone: 'fraud' } : undefined,
    },
  ];
  if (c && c.highRisk > 0) {
    items.push({
      to: '/admin/transactions?riskLevel=HIGH',
      label: 'High Risk',
      section: 'Risk',
      badge: { count: c.highRisk, tone: 'fraud' },
    });
  }
  if (c && c.reviewQueue > 0) {
    items.push({
      to: '/admin/transactions?fraud=pending',
      label: 'AI Review Queue',
      section: 'Risk',
      badge: { count: c.reviewQueue, tone: 'plain' },
    });
  }
  items.push({
    to: '/login',
    label: 'Logout',
    section: 'Account',
    onClick: () =>
      logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) }),
  });

  return (
    <SidebarShell
      brand="Sentinel"
      subtitle={tr('Admin Control Panel')}
      profile={{ initial: name.charAt(0).toUpperCase(), name, role: 'Administrator' }}
      items={items}
      footer={
        <>
          <div>{tr('Fraud Detection System v2.0')}</div>
          <div>{tr('Transaction screening')}</div>
        </>
      }
    />
  );
}
