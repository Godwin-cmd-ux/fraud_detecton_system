import { useLanguage, translate as tr } from '../../../i18n';
import { Link } from 'react-router';
import type { ReactNode } from 'react';
import type { AdminTxRow } from '../../../api/types';
import { RiskBadge, StatusBadge } from '../../../components/ui/Badge';
import { RiskBar } from '../../../components/ui/RiskBar';
import { Table, Td, Th } from '../../../components/ui/Table';
import { formatDate, formatTsh } from '../../../lib/format';

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export interface TransactionsTableProps {
  items: AdminTxRow[];
  /**
   * Alert layout (fraud alert pages): date & time first, "Unknown" for missing parties,
   * two-tone score colouring and a row class per risk level, as the original alert table.
   */
  alert?: boolean;
  /** Extra per-row controls rendered after the View link. */
  actions?: (row: AdminTxRow) => ReactNode;
  /** Hide the type and score columns (dashboard "recent" lists). */
  compact?: boolean;
}

/** Shared transaction table for the admin dashboard, monitoring and alert pages. */
export function TransactionsTable({
  items,
  alert = false,
  actions,
  compact = false,
}: TransactionsTableProps) {
  useLanguage();
  const nullParty = alert ? tr('Unknown') : tr('System');
  return (
    <Table>
      <thead>
        <tr>
          {alert && <Th>{tr('Date & Time')}</Th>}
          <Th>{tr('Transaction ID')}</Th>
          <Th>{tr('Sender')}</Th>
          <Th>{tr('Receiver')}</Th>
          <Th>{tr('Amount')}</Th>
          {!alert && !compact && <Th>{tr('Type')}</Th>}
          <Th>{tr('Status')}</Th>
          {!compact && <Th>{tr('Risk Score')}</Th>}
          <Th>{tr('Risk Level')}</Th>
          {!alert && <Th>{tr('Date')}</Th>}
          <Th>{tr('Actions')}</Th>
        </tr>
      </thead>
      <tbody>
        {items.map((r) => (
          <tr
            key={r.id}
            className={alert ? `alert-row-${(r.riskLevel ?? 'pending').toLowerCase()}` : undefined}
          >
            {alert && (
              <Td className="whitespace-nowrap text-p-muted">
                {formatDate(r.createdAt, 'second')}
              </Td>
            )}
            <Td className="font-mono text-xs">{r.transactionId}</Td>
            <Td>{r.senderName ?? nullParty}</Td>
            <Td>{r.receiverName ?? nullParty}</Td>
            <Td className="font-semibold whitespace-nowrap">{formatTsh(r.amount)}</Td>
            {!alert && !compact && <Td>{tr(capitalize(r.type))}</Td>}
            <Td>
              <StatusBadge status={r.status} />
              {r.reviewedAt && (
                <span className="ml-1 text-xs text-p-muted">{tr('· Reviewed')}</span>
              )}
            </Td>
            {!compact && (
              <Td>
                {r.fraudScore > 0 ? (
                  <RiskBar score={r.fraudScore} twoTone={alert} />
                ) : (
                  <span className="text-p-muted">{tr('N/A')}</span>
                )}
              </Td>
            )}
            <Td>
              <RiskBadge level={r.riskLevel} />
            </Td>
            {!alert && (
              <Td className="whitespace-nowrap text-p-muted">
                {formatDate(r.createdAt, 'minute')}
              </Td>
            )}
            <Td>
              <div className="flex flex-wrap gap-1.5">
                <Link
                  to={`/admin/transactions/${r.id}`}
                  className="rounded-lg border border-p-border bg-white px-2.5 py-1 text-xs font-medium text-p-primary transition hover:border-p-primary/40 hover:bg-p-primary/5"
                >
                  {tr('View')}
                </Link>
                {actions?.(r)}
              </div>
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
