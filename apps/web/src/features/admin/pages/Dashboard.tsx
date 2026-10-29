import { Link } from 'react-router';
import { useAdminDashboard } from '../../../api/admin';
import { useMe } from '../../../api/auth';
import { TopHeader } from '../../../components/layout/TopHeader';
import { Alert } from '../../../components/ui/Alert';
import { Spinner } from '../../../components/ui/Spinner';
import { StatCard, StatGrid } from '../../../components/ui/StatCard';
import { Card, EmptyState, Table, Td, Th } from '../../../components/ui/Table';
import { formatDate, formatTsh } from '../../../lib/format';
import { TransactionsTable } from '../components/TransactionsTable';

export function AdminDashboardPage() {
  const me = useMe();
  const q = useAdminDashboard();
  const name = me.data?.name ?? 'Administrator';
  if (q.isPending) return <Spinner />;
  if (q.isError || !q.data) return <Alert kind="error">Could not load the dashboard.</Alert>;
  const { kpis, recentAlerts, recentTransactions, recentUsers } = q.data;

  return (
    <div>
      <TopHeader title="Dashboard Overview" subtitle={`Welcome back, ${name}!`} name={name} hint="Administrator" />

      <StatGrid>
        <StatCard label="Total Users" value={kpis.totalUsers} sub="Registered accounts" icon="👥" />
        <StatCard label="Total Transactions" value={kpis.totalTransactions} sub="All time transactions" icon="💸" tone="purple" />
        <StatCard label="Successful" value={kpis.successful} sub="Completed transactions" icon="✅" tone="green" />
        <StatCard label="Aborted" value={kpis.aborted} sub="Suspicious transactions" icon="❌" tone="red" />
        <StatCard label="Total Money Moved" value={formatTsh(kpis.moneyMoved)} sub="Total volume processed" icon="💰" tone="amber" />
        <StatCard label="🚨 Fraud Detected" value={kpis.fraudDetected} sub="Transactions flagged as fraud" tone="red" />
        {kpis.highRisk > 0 && <StatCard label="🔴 High Risk" value={kpis.highRisk} sub="Immediate attention needed" tone="red" />}
        {kpis.reviewQueue > 0 && <StatCard label="🤖 AI Review Queue" value={kpis.reviewQueue} sub="Pending fraud analysis" tone="gray" />}
      </StatGrid>

      {recentAlerts.length > 0 && (
        <Card className="mt-6" title="🚨 Recent Fraud Alerts" actions={<Link to="/admin/fraud-alerts" className="text-sm font-semibold text-p-primary">View All Alerts →</Link>}>
          <TransactionsTable items={recentAlerts} alert />
        </Card>
      )}

      <Card className="mt-6" title="Recent Transactions" actions={<Link to="/admin/transactions" className="text-sm font-semibold text-p-primary">View All →</Link>}>
        {recentTransactions.length === 0 ? (
          <EmptyState title="No transactions yet" />
        ) : (
          <TransactionsTable items={recentTransactions} compact />
        )}
      </Card>

      <Card className="mt-6" title="Recent Users" actions={<Link to="/admin/users" className="text-sm font-semibold text-p-primary">View All →</Link>}>
        {recentUsers.length === 0 ? (
          <EmptyState title="No users yet" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Full Name</Th>
                <Th>Email</Th>
                <Th>Phone</Th>
                <Th>Balance</Th>
                <Th>Created</Th>
              </tr>
            </thead>
            <tbody>
              {recentUsers.map((u) => (
                <tr key={u.id}>
                  <Td className="font-medium">{u.fullName}</Td>
                  <Td>{u.email}</Td>
                  <Td>{u.phone}</Td>
                  <Td>{formatTsh(u.balance)}</Td>
                  <Td className="text-p-muted">{formatDate(u.createdAt, 'date')}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
