import { useNavigate } from 'react-router';
import { useLogout, useMe } from '../../api/auth';
import { SidebarShell } from '../../components/layout/SidebarShell';

export function UserLayout() {
  const me = useMe();
  const logout = useLogout();
  const navigate = useNavigate();
  const name = me.data?.name ?? 'Customer';
  return (
    <SidebarShell
      brand="🛡️ FraudDetect"
      subtitle="Customer Portal"
      profile={{ initial: name.charAt(0).toUpperCase(), name, role: 'Customer' }}
      items={[
        { to: '/app/dashboard', label: 'Dashboard', icon: '📊' },
        { to: '/app/send', label: 'Send Money', icon: '💸' },
        { to: '/app/withdraw', label: 'Withdraw', icon: '🏧' },
        { to: '/app/transactions', label: 'Transactions', icon: '📜' },
        {
          to: '/login',
          label: 'Logout',
          icon: '🚪',
          onClick: () => {
            logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) });
          },
        },
      ]}
      footer={
        <>
          <div>Fraud Detection System v2.0</div>
          <div>🤖 AI-Powered Fraud Detection</div>
        </>
      }
    />
  );
}
