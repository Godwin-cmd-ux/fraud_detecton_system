import { useLanguage, translate as tr } from '../../../i18n';
import type { TransactionListItem } from '@fraud/shared';
import { ArrowDownLeft, ArrowDownToLine, ArrowUpRight, Plus } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { PredictionBadge, RiskBadge, StatusBadge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { formatDate, formatTsh, riskColor } from '../../../lib/format';
import { describeTransaction } from '../../../lib/transactions';
import { ReceiptButton } from './ReceiptButton';

const directionIcons = {
  sent: { Icon: ArrowUpRight, tone: 'tx-dir--out' },
  withdrawal: { Icon: ArrowDownToLine, tone: 'tx-dir--out' },
  received: { Icon: ArrowDownLeft, tone: 'tx-dir--in' },
  deposit: { Icon: Plus, tone: 'tx-dir--in' },
} as const;

/** Table cell content: a direction marker followed by the description. */
export function TransactionLabel({ t }: { t: TransactionListItem }) {
  useLanguage();
  const { Icon, tone } = directionIcons[t.direction];
  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
      <span className={`tx-dir ${tone}`} aria-hidden="true">
        <Icon size={14} strokeWidth={2} />
      </span>
      {tr(describeTransaction(t))}
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  useLanguage();
  return (
    <div className="flex items-start justify-between gap-4 border-b border-p-border py-2 text-sm last:border-b-0">
      <span className="text-p-muted">{tr(label)}</span>
      <span className="text-right font-medium text-p-dark">{children}</span>
    </div>
  );
}

export function TransactionDetailsModal({
  transaction,
  onClose,
}: {
  transaction: TransactionListItem | null;
  onClose: () => void;
}) {
  useLanguage();
  const t = transaction;

  return (
    <Modal
      open={t !== null}
      onClose={onClose}
      title={tr('Transaction Details')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tr('Close')}
          </Button>
          {t && <ReceiptButton transaction={t} />}
        </>
      }
    >
      {t && (
        <div>
          <Row label={tr('Transaction ID')}>
            <span className="font-mono text-xs">{t.transactionId}</span>
          </Row>
          <Row label={tr('Type')}>{tr(describeTransaction(t))}</Row>
          <Row label={tr('Amount')}>{formatTsh(t.amount)}</Row>
          <Row label={tr('Status')}>
            <StatusBadge status={t.status} />
          </Row>
          <Row label={tr('Date')}>{formatDate(t.createdAt, 'second')}</Row>
          {t.location && <Row label={tr('Location')}>{t.location}</Row>}
          {t.fraudScore > 0 && (
            <div
              className="mt-4 rounded-lg border border-p-border p-3"
              style={{ borderLeft: `4px solid ${riskColor(t.fraudScore)}` }}
            >
              <div className="mb-2 text-sm font-bold text-p-dark">{tr('Fraud Analysis')}</div>
              <Row label={tr('Risk Score')}>
                <span style={{ color: riskColor(t.fraudScore) }}>{t.fraudScore}%</span>
              </Row>
              <Row label={tr('Prediction')}>
                <PredictionBadge prediction={t.fraudPrediction} />
              </Row>
              <Row label={tr('Risk Level')}>
                <RiskBadge level={t.riskLevel} />
              </Row>
              {t.fraudScore > 70 && (
                <p className="mt-2 text-sm font-semibold text-p-danger">
                  {tr('This transaction was flagged as high risk')}
                </p>
              )}
            </div>
          )}
          {t.message && (
            <div className="mt-4 rounded-lg bg-p-bg p-3 text-sm whitespace-pre-line">
              <span className="font-semibold">{tr('Message: ')}</span>
              {t.message}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
