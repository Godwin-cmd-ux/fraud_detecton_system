import { useLanguage, translate as tr } from '../../../i18n';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { ShieldCheck } from 'lucide-react';
import { DEFAULT_LOCATION, FEES, FRAUD, feeFor, feePercent, totalWithFee } from '@fraud/shared';
import type { Location, TransactionListItem, TransferResult } from '@fraud/shared';
import { useCardLookup, useSendContext, useTransfer } from '../../../api/me';
import { TopHeader } from '../../../components/layout/TopHeader';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Input } from '../../../components/ui/Input';
import { Spinner } from '../../../components/ui/Spinner';
import { Textarea } from '../../../components/ui/Textarea';
import { formatTsh } from '../../../lib/format';
import { currentCoordinates } from '../../../lib/geo';
import { receiptFromResult } from '../../../lib/receipt';
import { BlockedPanel } from '../components/BlockedPanel';
import { ReceiptButton } from '../components/ReceiptButton';

interface Pending {
  title: string;
  body: string;
  danger?: boolean;
}

const formatCardNumber = (value: string): string =>
  value
    .replace(/\D/g, '')
    .slice(0, 16)
    .replace(/(.{4})/g, '$1 ')
    .trim();

export function SendPage() {
  useLanguage();
  const [cardNumber, setCardNumber] = useState('');
  const digits = cardNumber.replace(/\D/g, '');
  // The typed card number resolves to the recipient; nothing else picks a receiver any more.
  const lookup = useCardLookup(cardNumber);
  const holder = lookup.data ?? null;
  const context = useSendContext(holder?.id);
  const transfer = useTransfer();
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<TransferResult | null>(null);
  const [receipt, setReceipt] = useState<TransactionListItem | null>(null);
  const [confirmQueue, setConfirmQueue] = useState<Pending[]>([]);

  const ctx = context.data;
  const amountValue = Number(amount);
  const fee = feeFor(amountValue, FEES.TRANSFER_RATE);
  const total = totalWithFee(amountValue, FEES.TRANSFER_RATE);

  /** The original page's pre-checks, as a chain of in-app confirmations instead of alert/confirm. */
  function preChecks(): Pending[] | string {
    if (!ctx) return 'Please wait for the page to load';
    const value = Number(amount);
    if (digits.length !== 16) return 'Enter the 16-digit card number';
    if (!holder) return 'No account found for that card number';
    if (!Number.isFinite(value) || value <= 0) return 'Please enter a valid amount greater than 0';
    if (totalWithFee(value, FEES.TRANSFER_RATE) > ctx.balance)
      return `Insufficient balance. Your balance is ${formatTsh(ctx.balance)} (amount ${formatTsh(value)} + fee ${formatTsh(feeFor(value, FEES.TRANSFER_RATE))})`;

    const queue: Pending[] = [];
    const { largeVolume, receivers, senders } = ctx;
    if (value > FRAUD.LARGE_TX_THRESHOLD) {
      const newCount = largeVolume.count + 1;
      const newAmount = largeVolume.totalAmount + value;
      if (newCount >= FRAUD.LARGE_VOLUME_MAX_COUNT && newAmount > FRAUD.LARGE_VOLUME_MAX_SUM) {
        return 'You have reached the maximum of 3 large transactions totaling 10,000,000 TSh in 5 minutes. This transaction will be BLOCKED.';
      }
      if (largeVolume.count >= 2) {
        queue.push({
          title: 'Large transaction warning',
          body: `You have made ${largeVolume.count} large transactions totaling ${formatTsh(largeVolume.totalAmount)} in the last 5 minutes.\nThis transaction will make ${newCount} transactions totaling ${formatTsh(newAmount)}.\nIf this exceeds 3 transactions or 10,000,000 TSh, it will be BLOCKED. Continue?`,
          danger: true,
        });
      }
    }
    if (receivers.unique >= FRAUD.MANY_RECEIVERS_BLOCK_AT) {
      return `You have reached the maximum of ${FRAUD.MANY_RECEIVERS_BLOCK_AT - 1} recipients in 5 minutes. This transaction will be BLOCKED.`;
    }
    if (receivers.unique >= FRAUD.MANY_RECEIVERS_BLOCK_AT - 1) {
      queue.push({
        title: 'Many recipients',
        body: `You have sent to ${receivers.unique} recipients in the last 5 minutes.\nSending to another recipient will result in your account being blocked. Continue?`,
        danger: true,
      });
    }
    if (senders.unique >= FRAUD.MANY_SENDERS_BLOCK_AT) {
      return `The recipient has reached the maximum of ${FRAUD.MANY_SENDERS_BLOCK_AT - 1} senders in 7 minutes. This transaction will be BLOCKED.`;
    }
    if (senders.unique >= FRAUD.MANY_SENDERS_BLOCK_AT - 1) {
      queue.push({
        title: 'Recipient activity',
        body: `The recipient has received from ${senders.unique} different senders in the last 7 minutes.\nSending to this recipient will result in the account being blocked. Continue?`,
        danger: true,
      });
    }
    queue.push({
      title: 'Confirm transfer',
      body: `You are about to send ${formatTsh(value)} to ${holder.fullName} (card •••• ${holder.cardLast4}). Continue?`,
    });
    return queue;
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const checks = preChecks();
    if (typeof checks === 'string') {
      setError(checks);
      return;
    }
    setConfirmQueue(checks);
  }

  async function onConfirm() {
    const [, ...rest] = confirmQueue;
    if (rest.length > 0) {
      setConfirmQueue(rest);
      return;
    }
    setConfirmQueue([]);
    // Silent geolocation: the API maps the reading to a city and falls back to the last known one.
    const coordinates = await currentCoordinates();
    // The form clears on success, so keep what was submitted for the receipt.
    const submitted = {
      direction: 'sent' as const,
      amount: Number(amount),
      counterpartyName: holder?.fullName ?? null,
      location: (ctx?.defaultLocation ?? DEFAULT_LOCATION) as Location,
      message,
    };
    setReceipt(null);
    transfer.mutate(
      {
        cardNumber: digits,
        amount: Number(amount),
        coordinates,
        message: message || undefined,
      },
      {
        onSuccess: (r) => {
          setResult(r);
          if (r.outcome === 'success') {
            setReceipt(receiptFromResult(r, submitted));
            setAmount('');
            setMessage('');
            setCardNumber('');
          }
        },
        onError: (err) => setError(err.message),
      },
    );
  }

  function reset() {
    setAmount('');
    setMessage('');
    setCardNumber('');
    setError('');
  }

  const blocked = result?.outcome === 'blocked' ? result : null;
  const current = confirmQueue[0];

  return (
    <div>
      <TopHeader title={tr('Send Money')} subtitle={tr('Transfer funds to other users')} />

      <div className="mx-auto max-w-2xl rounded-card border border-p-border bg-white p-6 shadow-sm">
        {blocked && (
          <BlockedPanel
            title={tr('TRANSACTION BLOCKED')}
            reason="This transaction was blocked by our fraud detection system."
            details={blocked.message}
          />
        )}

        {result?.outcome === 'success' && (
          <Alert kind="success" className="mb-4">
            {tr(result.message)}
            {result.flaggedForReview && (
              <div className="mt-2 border-t border-ok/20 pt-2">
                {tr('This transaction was flagged for review. Please monitor your account.')}
              </div>
            )}
            {receipt && (
              <div className="mt-3">
                <ReceiptButton transaction={receipt} variant="secondary" size="sm" />
              </div>
            )}
          </Alert>
        )}

        {error && !blocked && (
          <Alert kind="error" className="mb-4">
            {tr(error)}
          </Alert>
        )}

        {result?.locationWarning && (
          <Alert kind="error" className="mb-4" title={tr('Location Change Detected')}>
            {tr(result.locationWarning)}
          </Alert>
        )}

        {ctx && ctx.largeVolume.count >= 2 && !ctx.largeVolume.blocked && !blocked && (
          <Alert kind="warning" className="mb-4">
            {tr('You have made ')}
            <strong>{ctx.largeVolume.count}</strong>
            {tr(' large transactions (>1M TSh) totaling ')}
            <strong>{formatTsh(ctx.largeVolume.totalAmount)}</strong>
            {tr(' in the last 5 minutes.')}
            {tr(' ')}
            <strong>{tr('Limit is 3 transactions totaling 10,000,000 TSh.')}</strong>
          </Alert>
        )}

        {context.isPending && <Spinner />}
        {context.isError && <Alert kind="error">{tr('Could not load the transfer form.')}</Alert>}

        {ctx && !blocked && (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <Input
              label={tr('Recipient card number *')}
              inputMode="numeric"
              autoComplete="off"
              maxLength={19}
              value={cardNumber}
              onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
              placeholder={tr('44•• •••• •••• ••••')}
              hint={tr('Enter the 16-digit card number of the person you are paying')}
              required
            />
            {digits.length === 16 && (
              <div className="rounded-[10px] border border-p-border bg-p-bg px-3.5 py-3 text-sm">
                {lookup.isFetching ? (
                  <span className="text-p-muted">{tr('Looking up the card holder…')}</span>
                ) : holder ? (
                  <span className="flex items-center gap-2">
                    <ShieldCheck size={16} className="text-ok" aria-hidden="true" />
                    <span>
                      {tr('Paying')} <strong>{holder.fullName}</strong>{' '}
                      <span className="tabular font-mono text-xs text-p-muted">•••• {holder.cardLast4}</span>
                    </span>
                  </span>
                ) : (
                  <span className="text-p-danger">
                    {tr(lookup.error instanceof Error ? lookup.error.message : 'No account found for that card number')}
                  </span>
                )}
              </div>
            )}
            <Input
              label={tr('Amount (TSh) *')}
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={tr('Enter amount in Tanzanian Shillings')}
              hint={tr(`Available balance: ${formatTsh(ctx.balance)}`)}
              required
            />
            {amountValue > 0 && (
              <div className="flex items-center justify-between rounded-[10px] border border-p-border bg-p-bg px-3.5 py-2.5 text-xs">
                <span className="text-p-muted">
                  {tr(`Fee (${feePercent(FEES.TRANSFER_RATE)})`)}
                </span>
                <span className="tabular text-p-dark">
                  {formatTsh(fee)} · {tr('Total')} <strong>{formatTsh(total)}</strong>
                </span>
              </div>
            )}
            <Textarea
              label={tr('Message (Optional)')}
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={tr('Add a reference or note...')}
              maxLength={500}
            />
            <div className="flex gap-2">
              <Button type="submit" loading={transfer.isPending}>
                {tr('Send Money')}
              </Button>
              <Button variant="secondary" onClick={reset}>
                {tr('Reset')}
              </Button>
            </div>
          </form>
        )}
      </div>

      <ConfirmDialog
        open={current !== undefined}
        title={tr(current?.title ?? '')}
        body={tr(current?.body)}
        confirmText={tr('Continue')}
        danger={current?.danger}
        loading={transfer.isPending}
        onConfirm={onConfirm}
        onCancel={() => setConfirmQueue([])}
      />
    </div>
  );
}
