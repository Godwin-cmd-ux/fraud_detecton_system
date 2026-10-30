import { useLanguage, translate as tr } from '../../../i18n';
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
  useLanguage();
  const me = useMe();
  const q = useAdminDashboard();
  const name = me.data?.name ?? 'Administrator';
  if (q.isPending) return <Spinner />;
  if (q.isError || !q.data)
    return <Alert kind="error">{tr('Could not load the dashboard.')}</Alert>;
  const { kpis, recentAlerts, recentTransactions, recentUsers } = q.data;

  return (
    <div>
      <TopHeader title={tr('Dashboard Overview')} subtitle={tr(`Welcome back, ${name}!`)} />

      <StatGrid>
        <StatCard
          label={tr('Total Users')}
          value={kpis.totalUsers}
          sub={tr('Registered accounts')}
          icon="users"
        />
        <StatCard
          label={tr('Total Transactions')}
          value={kpis.totalTransactions}
          sub={tr('All time transactions')}
          icon="transfer"
          tone="purple"
        />
        <StatCard
          label={tr('Successful')}
          value={kpis.successful}
          sub={tr('Completed transactions')}
          icon="success"
          tone="green"
        />
        <StatCard
          label={tr('Aborted')}
          value={kpis.aborted}
          sub={tr('Suspicious transactions')}
          icon="failed"
          tone="red"
        />
        <StatCard
          label={tr('Total Money Moved')}
          value={formatTsh(kpis.moneyMoved)}
          sub={tr('Total volume processed')}
          icon="wallet"
          tone="amber"
        />
        <StatCard
          label={tr('Revenue Today')}
          value={formatTsh(kpis.revenueToday)}
          sub={tr(`Fees collected · ${formatTsh(kpis.revenueTotal)} all time`)}
          icon="trend"
          tone="green"
        />
        <StatCard
          label={tr('Fraud Detected')}
          icon="fraud"
          value={kpis.fraudDetected}
          sub={tr('Transactions flagged as fraud')}
          tone="red"
        />
        {kpis.highRisk > 0 && (
          <StatCard
            label={tr('High Risk')}
            icon="risk"
            value={kpis.highRisk}
            sub={tr('Immediate attention needed')}
            tone="red"
          />
        )}
        {kpis.reviewQueue > 0 && (
          <StatCard
            label={tr('AI Review Queue')}
            icon="queue"
            value={kpis.reviewQueue}
            sub={tr('Pending fraud analysis')}
            tone="gray"
          />
        )}
      </StatGrid>

      {recentAlerts.length > 0 && (
        <Card
          className="mt-6"
          title={tr('Recent Fraud Alerts')}
          actions={
            <Link to="/admin/fraud-alerts" className="card-link">
              {tr('View All Alerts →')}
            </Link>
          }
        >
          <TransactionsTable items={recentAlerts} alert />
        </Card>
      )}

      <Card
        className="mt-6"
        title={tr('Recent Transactions')}
        actions={
          <Link to="/admin/transactions" className="card-link">
            {tr('View All →')}
          </Link>
        }
      >
        {recentTransactions.length === 0 ? (
          <EmptyState title={tr('No transactions yet')} />
        ) : (
          <TransactionsTable items={recentTransactions} compact />
        )}
      </Card>

      <Card
        className="mt-6"
        title={tr('Recent Users')}
        actions={
          <Link to="/admin/users" className="card-link">
            {tr('View All →')}
          </Link>
        }
      >
        {recentUsers.length === 0 ? (
          <EmptyState title={tr('No users yet')} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{tr('Full Name')}</Th>
                <Th>{tr('Email')}</Th>
                <Th>{tr('Phone')}</Th>
                <Th>{tr('Balance')}</Th>
                <Th>{tr('Created')}</Th>
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
