import { useLanguage, translate as tr } from '../../../i18n';
import { Link } from 'react-router';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useFraudOverview } from '../../../api/admin';
import { Alert } from '../../../components/ui/Alert';
import { StatCard, StatGrid } from '../../../components/ui/StatCard';
import { Spinner } from '../../../components/ui/Spinner';
import { Card, EmptyState, Table, Th, Td } from '../../../components/ui/Table';
import { formatTsh } from '../../../lib/format';
import { MonitoringHeader } from '../components/Monitoring';

export function FraudOverviewPage() {
  useLanguage();
  const query = useFraudOverview();
  const data = query.data;
  return (
    <div className="space-y-5">
      <MonitoringHeader title={tr('Fraud Detection Overview')} />
      {query.isPending && <Spinner />}
      {query.isError && <Alert kind="error">{tr('Could not load fraud overview.')}</Alert>}
      {data && (
        <>
          <StatGrid>
            <StatCard label={tr('Total transactions')} value={data.stats.total} />
            <StatCard label={tr('Fraud detected')} value={data.stats.fraud} tone="red" />
            <StatCard label={tr('Legitimate')} value={data.stats.legit} tone="green" />
            <StatCard label={tr('Pending review')} value={data.stats.pending} tone="amber" />
          </StatGrid>
          <StatGrid>
            <StatCard
              label={tr('High risk')}
              value={data.stats.highRisk}
              sub={tr(`${data.stats.highPct.toFixed(1)}% of total`)}
              tone="red"
            />
            <StatCard
              label={tr('Medium risk')}
              value={data.stats.mediumRisk}
              sub={tr(`${data.stats.mediumPct.toFixed(1)}% of total`)}
              tone="amber"
            />
            <StatCard
              label={tr('Low risk')}
              value={data.stats.lowRisk}
              sub={tr(`${data.stats.lowPct.toFixed(1)}% of total`)}
              tone="green"
            />
            <StatCard
              label={tr('Average risk score')}
              value={`${data.stats.avgScore.toFixed(1)}%`}
              sub={tr(
                `Range: ${data.stats.minScore.toFixed(1)}% – ${data.stats.maxScore.toFixed(1)}%`,
              )}
            />
          </StatGrid>
          <Card title={tr('Daily Fraud Trends')}>
            <div
              className="h-72"
              role="img"
              aria-label={tr('Daily total, fraud, and legitimate transaction trends')}
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.daily}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="total"
                    name={tr('Total')}
                    stroke="#2563eb"
                    fill="#2563eb"
                    fillOpacity={0.15}
                  />
                  <Area
                    type="monotone"
                    dataKey="fraud"
                    name={tr('Fraud')}
                    stroke="#ef4444"
                    fill="#ef4444"
                    fillOpacity={0.15}
                  />
                  <Area
                    type="monotone"
                    dataKey="legit"
                    name={tr('Legit')}
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.15}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {!data.daily.length && <p>{tr('No daily activity yet.')}</p>}
          </Card>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card title={tr('Transactions by Type')}>
              <div
                className="h-72"
                role="img"
                aria-label={tr('Total and fraud transactions grouped by type')}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.byType}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="type" tickFormatter={(type) => tr(String(type))} />
                    <YAxis allowDecimals={false} />
                    <Tooltip labelFormatter={(label) => tr(String(label))} />
                    <Legend />
                    <Bar dataKey="total" name={tr('Total')} fill="#2563eb" />
                    <Bar dataKey="fraud" name={tr('Fraud')} fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card title={tr('Hourly Activity')}>
              <div
                className="h-72"
                role="img"
                aria-label={tr('Total and fraud transactions grouped by hour')}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.byHour}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" tickFormatter={(hour) => `${hour}:00`} />
                    <YAxis allowDecimals={false} />
                    <Tooltip labelFormatter={(hour) => `${hour}:00`} />
                    <Legend />
                    <Bar dataKey="total" name={tr('Total')} fill="#2563eb" />
                    <Bar dataKey="fraud" name={tr('Fraud')} fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
          <Card title={tr('Top Suspects')}>
            {data.topSuspects.length ? (
              <Table>
                <thead>
                  <tr>
                    {['Customer', 'Email', 'Fraud count', 'Total amount', 'Action'].map((label) => (
                      <Th key={label}>{tr(label)}</Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.topSuspects.map((user) => (
                    <tr key={user.id}>
                      <Td>{user.fullName}</Td>
                      <Td>{user.email}</Td>
                      <Td>{user.fraudCount}</Td>
                      <Td>{formatTsh(user.totalAmount)}</Td>
                      <Td>
                        <Link
                          className="text-p-primary"
                          to={`/admin/users?search=${encodeURIComponent(user.fullName)}`}
                        >
                          {tr('View User')}
                        </Link>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <EmptyState title={tr('No suspicious users found')} />
            )}
          </Card>
          <Card title={tr('Quick Actions')}>
            <div className="flex flex-wrap gap-4">
              <Link to="/admin/fraud-alerts" className="text-p-primary">
                {tr('Review Fraud Alerts')}
              </Link>
              <Link to="/admin/transactions?riskLevel=HIGH" className="text-p-primary">
                {tr('High Risk Transactions')}
              </Link>
              <Link to="/admin/transactions?fraud=pending" className="text-p-primary">
                {tr('AI Review Queue')}
              </Link>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
