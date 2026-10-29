import { Link, useParams } from 'react-router';
import { useAdminTransaction } from '../../../api/admin';
import { Alert } from '../../../components/ui/Alert';
import { RiskBadge, StatusBadge } from '../../../components/ui/Badge';
import { Spinner } from '../../../components/ui/Spinner';
import { Card, EmptyState } from '../../../components/ui/Table';
import { formatDate, formatTsh, riskColor } from '../../../lib/format';
import { MonitoringHeader } from '../components/Monitoring';

export function TransactionDetailsPage() {
  const { id } = useParams();
  const validId = Number(id) > 0 && Number.isInteger(Number(id));
  const query = useAdminTransaction(validId ? Number(id) : undefined);
  const tx = query.data;
  return (
    <div className="space-y-5">
      <MonitoringHeader title="Transaction Details" />
      <Link to="/admin/transactions" className="text-p-primary">
        ← Back to Transactions
      </Link>
      {!validId && <Alert kind="error">Invalid transaction ID.</Alert>}
      {validId && query.isPending && <Spinner />}
      {query.isError && <Alert kind="error">Could not load transaction details.</Alert>}
      {tx && (
        <>
          <Card title="Transaction Information">
            <dl className="grid gap-3 sm:grid-cols-2">
              {Object.entries({
                'Transaction ID': tx.transactionId,
                Amount: formatTsh(tx.amount),
                Type: tx.type,
                Date: formatDate(tx.createdAt, 'second'),
                Location: tx.location ?? 'N/A',
                Message: tx.message ?? 'N/A',
                'IP address': tx.ipAddress ?? 'N/A',
                'User agent': tx.userAgent ?? 'N/A',
                Administrator: tx.admin ? `${tx.admin.fullName} @${tx.admin.username}` : 'System',
              }).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-sm text-p-muted">{label}</dt>
                  <dd className="break-words font-semibold">{value}</dd>
                </div>
              ))}
              <div>
                <dt>Status</dt>
                <dd>
                  <StatusBadge status={tx.status} />
                </dd>
              </div>
            </dl>
          </Card>
          <div className="grid gap-5 md:grid-cols-2">
            {(['sender', 'receiver'] as const).map((role) => (
              <Card key={role} title={`${role === 'sender' ? 'Sender' : 'Receiver'} Information`}>
                {tx[role] ? (
                  <div className="space-y-2">
                    <p className="font-bold">{tx[role].fullName}</p>
                    <p>{tx[role].email}</p>
                    <p>{tx[role].phone}</p>
                    <p>Balance: {formatTsh(tx[role].balance)}</p>
                  </div>
                ) : (
                  <p>System</p>
                )}
              </Card>
            ))}
          </div>
          <Card title="Fraud Detection Analysis">
            {tx.fraudScore > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <strong style={{ color: riskColor(tx.fraudScore) }}>
                    {tx.fraudScore.toFixed(1)}%
                  </strong>
                  <RiskBadge level={tx.riskLevel} />
                </div>
                <div
                  role="meter"
                  aria-label="Fraud risk score"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={tx.fraudScore}
                  className="h-4 overflow-hidden rounded bg-gray-100"
                >
                  <div
                    className="h-full"
                    style={{
                      width: `${Math.min(100, Math.max(0, tx.fraudScore))}%`,
                      background: riskColor(tx.fraudScore),
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs text-p-muted">
                  <span>0</span>
                  <span>30</span>
                  <span>70</span>
                  <span>100</span>
                </div>
                <p>Model version: {tx.modelVersion ?? 'N/A'}</p>
                <p>Prediction time: {tx.predictionTime ?? 'N/A'}</p>
                <h3 className="font-bold">Key Features</h3>
                <dl className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(tx.featureData ?? { Features: null }).map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-p-muted">{key.replaceAll('_', ' ')}</dt>
                      <dd>
                        {value == null
                          ? 'N/A'
                          : typeof value === 'object'
                            ? JSON.stringify(value)
                            : String(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
                {tx.fraudScore > 70 && (
                  <Link to="/admin/fraud-alerts" className="font-semibold text-p-danger">
                    View All Fraud Alerts
                  </Link>
                )}
              </div>
            ) : (
              <EmptyState title="No Fraud Analysis Available" />
            )}
          </Card>
        </>
      )}
    </div>
  );
}
