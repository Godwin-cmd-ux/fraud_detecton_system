import { useLanguage, translate as tr } from '../../../i18n';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { FRAUD } from '@fraud/shared';
import type { Location, WithdrawalResult } from '@fraud/shared';
import { useMe } from '../../../api/auth';
import { useWithdraw, useWithdrawContext } from '../../../api/me';
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

const LOCKED_REASON = 'You have exceeded the number of failed withdrawal attempts.';

export function WithdrawPage() {
  useLanguage();
  const me = useMe();
  const context = useWithdrawContext();
  const withdraw = useWithdraw();
  const [location, setLocation] = useState<Location | ''>('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<WithdrawalResult | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!location && context.data) setLocation(context.data.defaultLocation);
  }, [context.data, location]);

  const ctx = context.data;
  const name = me.data?.name ?? 'Customer';
  const value = Number(amount);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!Number.isFinite(value) || value < FRAUD.MIN_WITHDRAWAL) {
      setError('Minimum withdrawal amount is TSh 1,000');
      return;
    }
    setConfirming(true);
  }

  function onConfirm() {
    setConfirming(false);
    withdraw.mutate(
      { amount: value, location: location as Location, message: message || undefined },
      {
        onSuccess: (r) => {
          setResult(r);
          if (r.outcome === 'success') {
            setAmount('');
            setMessage('');
          }
        },
        onError: (err) => setError(err.message),
      },
    );
  }

  const blocked = result?.outcome === 'blocked' ? result : null;
  const lockedOut = ctx?.blocked && !blocked;
  const confirmBody =
    ctx && ctx.failedAttempts >= 2
      ? `⚠️ You have ${ctx.failedAttempts} previous failed attempts. One more failed attempt will block your withdrawals.\n\nYou are about to withdraw ${formatTsh(value)}. Continue?`
      : `You are about to withdraw ${formatTsh(value)}. Continue?`;

  return (
    <div>
      <TopHeader
        title={tr('Withdraw')}
        subtitle={tr('Withdraw funds from your account')}
        name={name}
        hint={tr('Making a withdrawal')}
      />

      <div className="mx-auto max-w-2xl rounded-card border border-p-border bg-white p-6 shadow-sm">
        {blocked && (
          <BlockedPanel
            title={tr('🚫 WITHDRAWAL BLOCKED')}
            reason="This withdrawal was blocked by our fraud detection system."
            details={blocked.message}
          />
        )}
        {lockedOut && (
          <BlockedPanel
            title={tr('🚫 WITHDRAWALS BLOCKED')}
            reason={LOCKED_REASON}
            details={`You have ${ctx.failedAttempts} consecutive failed withdrawal attempts. Withdrawals are temporarily blocked. Please contact support to unblock your account.`}
          />
        )}

        {result?.outcome === 'success' && (
          <Alert kind="success" className="mb-4">
            {tr(result.message)}
          </Alert>
        )}
        {result?.outcome === 'failed' && (
          <Alert kind="error" className="mb-4">
            {tr(result.message)}
            <div className="mt-1 text-xs">
              {tr('Failed attempts: ')}
              {result.failedAttempts}/{FRAUD.FAILED_WITHDRAWAL_BLOCK_COUNT}
            </div>
          </Alert>
        )}
        {error && (
          <Alert kind="error" className="mb-4">
            {tr(error)}
          </Alert>
        )}

        {context.isPending && <Spinner />}
        {context.isError && <Alert kind="error">{tr('Could not load the withdrawal form.')}</Alert>}

        {ctx && !blocked && !lockedOut && (
          <>
            <Alert kind="info" className="mb-4">
              <ul className="list-inside list-disc">
                <li>{tr('Minimum withdrawal: TSh 1,000')}</li>
                <li>{tr('Funds are deducted from your balance immediately')}</li>
                <li>{tr('Keep your receipt for your records')}</li>
              </ul>
            </Alert>
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <Select
                label={tr('Location *')}
                value={location}
                onChange={(e) => setLocation(e.target.value as Location)}
                required
              >
                {ctx.locations.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </Select>
              <Input
                label={tr('Amount (TSh) *')}
                type="number"
                step="0.01"
                min={FRAUD.MIN_WITHDRAWAL}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={tr('Minimum TSh 1,000')}
                hint={tr(`Available balance: ${formatTsh(ctx.balance)}`)}
                required
              />
              <Textarea
                label={tr('Reason/Reference (Optional)')}
                rows={2}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={500}
              />
              <div className="flex gap-2">
                <Button type="submit" variant="success" loading={withdraw.isPending}>
                  {tr('Withdraw')}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setAmount('');
                    setMessage('');
                    setError('');
                  }}
                >
                  {tr('Reset')}
                </Button>
              </div>
            </form>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirming}
        title={tr('Confirm withdrawal')}
        body={tr(confirmBody)}
        confirmText={tr('Continue')}
        danger={!!ctx && ctx.failedAttempts >= 2}
        onConfirm={onConfirm}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
