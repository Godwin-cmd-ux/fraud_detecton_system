import type { TransactionListItem } from '@fraud/shared';
import { translate as tr } from '../i18n';

/** Plain-text row label for a transaction, from the current user's point of view. */
export function describeTransaction(t: TransactionListItem): string {
  switch (t.direction) {
    case 'withdrawal':
      return 'Withdrawal';
    case 'deposit':
      return `${t.type.charAt(0).toUpperCase()}${t.type.slice(1)}`;
    case 'sent':
      return `Sent to ${t.counterpartyName ?? tr('Unknown')}`;
    case 'received':
      return `Received from ${t.counterpartyName ?? tr('Unknown')}`;
  }
}
