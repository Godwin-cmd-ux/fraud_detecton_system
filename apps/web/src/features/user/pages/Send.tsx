import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { FRAUD } from '@fraud/shared';
import type { Location, TransferResult } from '@fraud/shared';
import { useMe } from '../../../api/auth';
import { useSendContext, useTransfer } from '../../../api/me';
import { TopHeader } from '../../../components/layout/TopHeader';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Spinner } from '../../../components/ui/Spinner';
import { Textarea } from '../../../components/ui/Textarea';
import { formatTsh } from '../../../lib/format';
import { BlockedPanel } from '../components/BlockedPanel';

interface Pending {
  title: string;
  body: string;
  danger?: boolean;
}

export function SendPage() {
  const me = useMe();
  const [receiverId, setReceiverId] = useState('');
  const context = useSendContext(receiverId ? Number(receiverId) : undefined);
  const transfer = useTransfer();
  const [location, setLocation] = useState<Location | ''>('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<TransferResult | null>(null);
  const [confirmQueue, setConfirmQueue] = useState<Pending[]>([]);

  useEffect(() => {
    if (!location && context.data) setLocation(context.data.defaultLocation);
  }, [context.data, location]);

  const ctx = context.data;
  const name = me.data?.name ?? 'Customer';

  /** The original page's pre-checks, as a chain of in-app confirmations instead of alert/confirm. */
  function preChecks(): Pending[] | string {
    if (!ctx) return 'Please wait for the page to load';
    const value = Number(amount);
    if (!receiverId) return 'Please select a receiver';
    if (!Number.isFinite(value) || value <= 0) return 'Please enter a valid amount greater than 0';
    if (value > ctx.balance) return `Insufficient balance. Your balance is ${formatTsh(ctx.balance)}`;

    const queue: Pending[] = [];
    const { largeVolume, receivers, senders } = ctx;
    if (value > FRAUD.LARGE_TX_THRESHOLD) {
      const newCount = largeVolume.count + 1;
      const newAmount = largeVolume.totalAmount + value;
      if (newCount >= FRAUD.LARGE_VOLUME_MAX_COUNT && newAmount > FRAUD.LARGE_VOLUME_MAX_SUM) {
        return '❌ You have reached the maximum of 3 large transactions totaling 10,000,000 TSh in 5 minutes. This transaction will be BLOCKED.';
      }
      if (largeVolume.count >= 2) {
        queue.push({
          title: '⚠️ Large transaction warning',
          body: `You have made ${largeVolume.count} large transactions totaling ${formatTsh(largeVolume.totalAmount)} in the last 5 minutes.\nThis transaction will make ${newCount} transactions totaling ${formatTsh(newAmount)}.\nIf this exceeds 3 transactions or 10,000,000 TSh, it will be BLOCKED. Continue?`,
          danger: true,
        });
      }
    }
    if (receivers.unique >= FRAUD.MANY_RECEIVERS_BLOCK_AT) {
      return `❌ You have reached the maximum of ${FRAUD.MANY_RECEIVERS_BLOCK_AT - 1} recipients in 5 minutes. This transaction will be BLOCKED.`;
    }
    if (receivers.unique >= FRAUD.MANY_RECEIVERS_BLOCK_AT - 1) {
      queue.push({
        title: '⚠️ Many recipients',
        body: `You have sent to ${receivers.unique} recipients in the last 5 minutes.\nSending to another recipient will result in your account being blocked. Continue?`,
        danger: true,
      });
    }
    if (senders.unique >= FRAUD.MANY_SENDERS_BLOCK_AT) {
      return `❌ The recipient has reached the maximum of ${FRAUD.MANY_SENDERS_BLOCK_AT - 1} senders in 7 minutes. This transaction will be BLOCKED.`;
    }
    if (senders.unique >= FRAUD.MANY_SENDERS_BLOCK_AT - 1) {
      queue.push({
        title: '⚠️ Recipient activity',
        body: `The recipient has received from ${senders.unique} different senders in the last 7 minutes.\nSending to this recipient will result in the account being blocked. Continue?`,
        danger: true,
      });
    }
    queue.push({ title: 'Confirm transfer', body: `You are about to send ${formatTsh(value)} to the selected recipient. Continue?` });
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

  function onConfirm() {
    const [, ...rest] = confirmQueue;
    if (rest.length > 0) {
      setConfirmQueue(rest);
      return;
    }
    setConfirmQueue([]);
    transfer.mutate(
      { receiverId: Number(receiverId), amount: Number(amount), location: location as Location, message: message || undefined },
      {
        onSuccess: (r) => {
          setResult(r);
          if (r.outcome === 'success') {
            setAmount('');
            setMessage('');
            setReceiverId('');
          }
        },
        onError: (err) => setError(err.message),
      },
    );
  }

  function reset() {
    setAmount('');
    setMessage('');
    setReceiverId('');
    setError('');
  }

  const blocked = result?.outcome === 'blocked' ? result : null;
  const current = confirmQueue[0];

  return (
    <div>
      <TopHeader title="Send Money" subtitle="Transfer funds to other users" name={name} hint="Making a transfer" />

      <div className="mx-auto max-w-2xl rounded-card border border-p-border bg-white p-6 shadow-sm">
        {blocked && (
          <BlockedPanel title="🚫 TRANSACTION BLOCKED" reason="This transaction was blocked by our fraud detection system." details={blocked.message} />
        )}

        {result?.outcome === 'success' && (
          <Alert kind="success" className="mb-4">
            {result.message}
            {result.flaggedForReview && (
              <div className="mt-2 border-t border-[#065f46]/20 pt-2">⚠️ This transaction was flagged for review. Please monitor your account.</div>
            )}
          </Alert>
        )}

        {error && !blocked && (
          <Alert kind="error" className="mb-4">
            {error}
          </Alert>
        )}

        {result?.locationWarning && (
          <div className="mb-4 rounded-lg border-l-4 border-[#dc2626] bg-[#fee2e2] p-4">
            <div className="font-semibold text-[#991b1b]">🚨 Location Change Detected</div>
            <div className="mt-1 text-sm text-[#7f1d1d]">{result.locationWarning}</div>
          </div>
        )}

        {ctx && ctx.largeVolume.count >= 2 && !ctx.largeVolume.blocked && !blocked && (
          <Alert kind="warning" className="mb-4">
            You have made <strong>{ctx.largeVolume.count}</strong> large transactions (&gt;1M TSh) totaling <strong>{formatTsh(ctx.largeVolume.totalAmount)}</strong> in the last 5 minutes.{' '}
            <strong>Limit is 3 transactions totaling 10,000,000 TSh.</strong>
          </Alert>
        )}

        {context.isPending && <Spinner />}
        {context.isError && <Alert kind="error">Could not load the transfer form.</Alert>}

        {ctx && !blocked && (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <Select label="Select Receiver *" value={receiverId} onChange={(e) => setReceiverId(e.target.value)} required>
              <option value="">-- Select a user --</option>
              {ctx.recipients.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.fullName} - {r.email}
                </option>
              ))}
            </Select>
            <Select
              label="Transaction Location *"
              value={location}
              onChange={(e) => setLocation(e.target.value as Location)}
              hint="Select your current location for fraud detection"
              required
            >
              {ctx.locations.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
            <Input
              label="Amount (TSh) *"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount in Tanzanian Shillings"
              hint={`Available balance: ${formatTsh(ctx.balance)}`}
              required
            />
            <Textarea label="Message (Optional)" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Add a reference or note..." maxLength={500} />
            <div className="flex gap-2">
              <Button type="submit" loading={transfer.isPending}>
                Send Money
              </Button>
              <Button variant="secondary" onClick={reset}>
                Reset
              </Button>
            </div>
          </form>
        )}
      </div>

      <ConfirmDialog
        open={current !== undefined}
        title={current?.title ?? ''}
        body={current?.body}
        confirmText="Continue"
        danger={current?.danger}
        loading={transfer.isPending}
        onConfirm={onConfirm}
        onCancel={() => setConfirmQueue([])}
      />
    </div>
  );
}
