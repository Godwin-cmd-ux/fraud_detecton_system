import { getLocale, useLanguage, translate as tr } from '../../../i18n';
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

/** Validated for colour-vision separation on the white card surface (dataviz palette check). */
const SERIES = { total: '#5468a8', legit: '#309c70', fraud: '#c2412f' } as const;
const axis = { fontSize: 11, fill: '#66766f' };
const tooltip = {
  contentStyle: {
    borderRadius: 10,
    border: '1px solid #e1e5dd',
    boxShadow: '0 12px 28px -12px rgba(20,48,43,.25)',
    fontSize: 12,
  },
  labelStyle: { color: '#142e2b', fontWeight: 600, marginBottom: 4 },
};
const legend = { iconType: 'circle' as const, iconSize: 8, wrapperStyle: { fontSize: 12 } };
const shortDate = (value: unknown) =>
  new Date(String(value)).toLocaleDateString(getLocale(), { month: 'short', day: 'numeric' });
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
            <StatCard label={tr('Total transactions')} value={data.stats.total} icon="activity" />
            <StatCard
              label={tr('Fraud detected')}
              value={data.stats.fraud}
              icon="fraud"
              tone="red"
            />
            <StatCard
              label={tr('Legitimate')}
              value={data.stats.legit}
              icon="success"
              tone="green"
            />
            <StatCard
              label={tr('Pending review')}
              value={data.stats.pending}
              icon="queue"
              tone="amber"
            />
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
                  <CartesianGrid vertical={false} stroke="#eceee8" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={shortDate}
                    tick={axis}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={24}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={axis}
                    tickLine={false}
                    axisLine={false}
                    width={36}
                  />
                  <Tooltip {...tooltip} labelFormatter={shortDate} />
                  <Legend {...legend} />
                  <Area
                    type="monotone"
                    dataKey="total"
                    name={tr('Total')}
                    stroke={SERIES.total}
                    strokeWidth={2}
                    fill={SERIES.total}
                    fillOpacity={0}
                    strokeDasharray="4 3"
                    activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="fraud"
                    name={tr('Fraud')}
                    stroke={SERIES.fraud}
                    strokeWidth={2}
                    fill={SERIES.fraud}
                    fillOpacity={0.12}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="legit"
                    name={tr('Legit')}
                    stroke={SERIES.legit}
                    strokeWidth={2}
                    fill={SERIES.legit}
                    fillOpacity={0.12}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
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
                    <CartesianGrid vertical={false} stroke="#eceee8" />
                    <XAxis
                      dataKey="type"
                      tickFormatter={(type) => tr(String(type))}
                      tick={axis}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={axis}
                      tickLine={false}
                      axisLine={false}
                      width={40}
                    />
                    <Tooltip
                      {...tooltip}
                      cursor={{ fill: '#f4f5f1' }}
                      labelFormatter={(label) => tr(String(label))}
                    />
                    <Legend {...legend} />
                    <Bar
                      dataKey="total"
                      name={tr('Total')}
                      fill={SERIES.total}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={36}
                    />
                    <Bar
                      dataKey="fraud"
                      name={tr('Fraud')}
                      fill={SERIES.fraud}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={36}
                    />
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
                    <CartesianGrid vertical={false} stroke="#eceee8" />
                    <XAxis
                      dataKey="hour"
                      tickFormatter={(hour) => `${hour}:00`}
                      tick={axis}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={12}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={axis}
                      tickLine={false}
                      axisLine={false}
                      width={36}
                    />
                    <Tooltip
                      {...tooltip}
                      cursor={{ fill: '#f4f5f1' }}
                      labelFormatter={(hour) => `${hour}:00`}
                    />
                    <Legend {...legend} />
                    <Bar
                      dataKey="total"
                      name={tr('Total')}
                      fill={SERIES.total}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={36}
                    />
                    <Bar
                      dataKey="fraud"
                      name={tr('Fraud')}
                      fill={SERIES.fraud}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={36}
                    />
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
