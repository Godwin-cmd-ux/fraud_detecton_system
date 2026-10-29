import type { TransactionListItem } from '@fraud/shared';
import { Button } from '../../../components/ui/Button';
import { PredictionBadge, RiskBadge, StatusBadge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { formatDate, formatTsh, riskColor } from '../../../lib/format';

/** Row label; the dashboard used 📤/📥 arrows while the full list used 💸/💰, as in the original. */
export function describeTransaction(t: TransactionListItem, variant: 'dashboard' | 'list' = 'list'): string {
  switch (t.direction) {
    case 'withdrawal':
      return '🏧 Withdrawal';
    case 'deposit':
      return `💰 ${t.type.charAt(0).toUpperCase()}${t.type.slice(1)}`;
    case 'sent':
      return `${variant === 'dashboard' ? '📤' : '💸'} Sent to ${t.counterpartyName ?? 'Unknown'}`;
    case 'received':
      return `${variant === 'dashboard' ? '📥' : '💰'} Received from ${t.counterpartyName ?? 'Unknown'}`;
  }
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-p-border py-2 text-sm last:border-b-0">
      <span className="text-p-muted">{label}</span>
      <span className="text-right font-medium text-p-dark">{children}</span>
    </div>
  );
}

export function TransactionDetailsModal({ transaction, onClose }: { transaction: TransactionListItem | null; onClose: () => void }) {
  const t = transaction;
  return (
    <Modal open={t !== null} onClose={onClose} title="Transaction Details" footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      {t && (
        <div>
          <Row label="Transaction ID">
            <span className="font-mono text-xs">{t.transactionId}</span>
          </Row>
          <Row label="Type">{describeTransaction(t)}</Row>
          <Row label="Amount">{formatTsh(t.amount)}</Row>
          <Row label="Status">
            <StatusBadge status={t.status} />
          </Row>
          <Row label="Date">{formatDate(t.createdAt, 'second')}</Row>
          {t.location && <Row label="Location">{t.location}</Row>}
          {t.fraudScore > 0 && (
            <div className="mt-4 rounded-lg border border-p-border p-3" style={{ borderLeft: `4px solid ${riskColor(t.fraudScore)}` }}>
              <div className="mb-2 text-sm font-bold text-p-dark">🛡️ Fraud Analysis</div>
              <Row label="Risk Score">
                <span style={{ color: riskColor(t.fraudScore) }}>{t.fraudScore}%</span>
              </Row>
              <Row label="Prediction">
                <PredictionBadge prediction={t.fraudPrediction} />
              </Row>
              <Row label="Risk Level">
                <RiskBadge level={t.riskLevel} />
              </Row>
              {t.fraudScore > 70 && <p className="mt-2 text-sm font-semibold text-p-danger">⚠️ This transaction was flagged as high risk</p>}
            </div>
          )}
          {t.message && (
            <div className="mt-4 rounded-lg bg-p-bg p-3 text-sm whitespace-pre-line">
              <span className="font-semibold">Message: </span>
              {t.message}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
