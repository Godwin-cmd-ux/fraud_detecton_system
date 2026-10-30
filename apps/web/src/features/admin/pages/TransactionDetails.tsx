import { useLanguage, translate as tr } from '../../../i18n';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Download } from 'lucide-react';
import { useAdminTransaction } from '../../../api/admin';
import { useMe } from '../../../api/auth';
import type { AdminTxDetails } from '../../../api/types';
import { Button } from '../../../components/ui/Button';
import { Alert } from '../../../components/ui/Alert';
import { RiskBadge, StatusBadge } from '../../../components/ui/Badge';
import { Spinner } from '../../../components/ui/Spinner';
import { Card, EmptyState } from '../../../components/ui/Table';
import { formatDate, formatTsh, riskColor } from '../../../lib/format';
import { downloadAdminRecord } from '../../../lib/receipt';
import { MonitoringHeader } from '../components/Monitoring';

/** Saves the administrator copy of this transaction as a PDF, naming who generated it. */
function AdminRecordButton({ tx }: { tx: AdminTxDetails }) {
  useLanguage();
  const me = useMe();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function download() {
    setBusy(true);
    setFailed(false);
    try {
      const principal = me.data ?? (await me.refetch()).data;
      await downloadAdminRecord(tx, principal?.name ?? tr('Administrator'));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1.5">
      <Button variant="secondary" onClick={download} loading={busy}>
        {!busy && <Download size={15} aria-hidden="true" />}
        {tr(busy ? 'Preparing…' : 'Download record')}
      </Button>
      {failed && (
        <span role="alert" className="text-xs text-p-danger">
          {tr('Could not create the receipt. Please try again.')}
        </span>
      )}
    </span>
  );
}

export function TransactionDetailsPage() {
  useLanguage();
  const { id } = useParams();
  const validId = Number(id) > 0 && Number.isInteger(Number(id));
  const query = useAdminTransaction(validId ? Number(id) : undefined);
  const tx = query.data;
  return (
    <div className="space-y-5">
      <MonitoringHeader title={tr('Transaction Details')} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/admin/transactions" className="card-link">
          {tr('← Back to Transactions')}
        </Link>
        {tx && <AdminRecordButton tx={tx} />}
      </div>
      {!validId && <Alert kind="error">{tr('Invalid transaction ID.')}</Alert>}
      {validId && query.isPending && <Spinner />}
      {query.isError && <Alert kind="error">{tr('Could not load transaction details.')}</Alert>}
      {tx && (
        <>
          <Card title={tr('Transaction Information')}>
            <dl className="grid gap-3 sm:grid-cols-2">
              {Object.entries({
                'Transaction ID': tx.transactionId,
                Amount: formatTsh(tx.amount),
                Type: tr(tx.type),
                Date: formatDate(tx.createdAt, 'second'),
                Location: tx.location ?? tr('N/A'),
                Message: tx.message ?? tr('N/A'),
                'IP address': tx.ipAddress ?? tr('N/A'),
                'User agent': tx.userAgent ?? tr('N/A'),
                Administrator: tx.admin
                  ? `${tx.admin.fullName} @${tx.admin.username}`
                  : tr('System'),
              }).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-sm text-p-muted">{tr(label)}</dt>
                  <dd className="break-words font-semibold">{value}</dd>
                </div>
              ))}
              <div>
                <dt>{tr('Status')}</dt>
                <dd>
                  <StatusBadge status={tx.status} />
                </dd>
              </div>
            </dl>
          </Card>
          <div className="grid gap-5 md:grid-cols-2">
            {(['sender', 'receiver'] as const).map((role) => (
              <Card
                key={role}
                title={tr(`${role === 'sender' ? 'Sender' : 'Receiver'} Information`)}
              >
                {tx[role] ? (
                  <div className="space-y-2">
                    <p className="font-bold">{tx[role].fullName}</p>
                    <p>{tx[role].email}</p>
                    <p>{tx[role].phone}</p>
                    <p>
                      {tr('Balance: ')}
                      {formatTsh(tx[role].balance)}
                    </p>
                  </div>
                ) : (
                  <p>{tr('System')}</p>
                )}
              </Card>
            ))}
          </div>
          <Card title={tr('Fraud Detection Analysis')}>
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
                  aria-label={tr('Fraud risk score')}
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
                <p>
                  {tr('Model version: ')}
                  {tx.modelVersion ?? 'N/A'}
                </p>
                <p>
                  {tr('Prediction time: ')}
                  {tx.predictionTime ?? 'N/A'}
                </p>
                <h3 className="font-bold">{tr('Key Features')}</h3>
                <dl className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(tx.featureData ?? { Features: null }).map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-p-muted">{tr(key.replaceAll('_', ' '))}</dt>
                      <dd>
                        {tr(
                          value == null
                            ? 'N/A'
                            : typeof value === 'object'
                              ? JSON.stringify(value)
                              : String(value),
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
                {tx.fraudScore > 70 && (
                  <Link to="/admin/fraud-alerts" className="font-semibold text-p-danger">
                    {tr('View All Fraud Alerts')}
                  </Link>
                )}
              </div>
            ) : (
              <EmptyState title={tr('No Fraud Analysis Available')} />
            )}
          </Card>
        </>
      )}
    </div>
  );
}
