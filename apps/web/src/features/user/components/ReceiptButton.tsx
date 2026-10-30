import { useLanguage, translate as tr } from '../../../i18n';
import { useState } from 'react';
import type { TransactionListItem } from '@fraud/shared';
import { Download } from 'lucide-react';
import { useMe } from '../../../api/auth';
import { Button } from '../../../components/ui/Button';
import type { ButtonVariant } from '../../../components/ui/Button';
import { downloadReceipt } from '../../../lib/receipt';

/** Generates and saves the PDF receipt for one transaction; reports failures inline. */
export function ReceiptButton({
  transaction,
  variant = 'primary',
  size = 'md',
}: {
  transaction: TransactionListItem;
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
}) {
  useLanguage();
  const me = useMe();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function download() {
    setBusy(true);
    setFailed(false);
    try {
      // Normally cached by the route guard; fetch it if the cache was cleared.
      const principal = me.data ?? (await me.refetch()).data;
      await downloadReceipt(transaction, {
        name: principal?.name ?? tr('Customer'),
        email: principal?.email,
      });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1.5">
      <Button variant={variant} size={size} onClick={download} loading={busy}>
        {!busy && <Download size={15} aria-hidden="true" />}
        {tr(busy ? 'Preparing…' : 'Download receipt')}
      </Button>
      {failed && (
        <span role="alert" className="text-xs text-p-danger">
          {tr('Could not create the receipt. Please try again.')}
        </span>
      )}
    </span>
  );
}
