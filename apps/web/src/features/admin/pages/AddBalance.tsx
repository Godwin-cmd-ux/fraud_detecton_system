import { useLanguage, translate as tr } from '../../../i18n';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { ADJUSTMENT_TYPES, FRAUD, addBalanceSchema } from '@fraud/shared';
import type { AdjustmentType } from '@fraud/shared';
import { useAddBalance, useAdminUser, useUserAdjustments } from '../../../api/admin';
import { useMe } from '../../../api/auth';
import { TopHeader } from '../../../components/layout/TopHeader';
import { Alert } from '../../../components/ui/Alert';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Spinner } from '../../../components/ui/Spinner';
import { Textarea } from '../../../components/ui/Textarea';
import { Card, EmptyState, Table, Td, Th } from '../../../components/ui/Table';
import { formatDate, formatTsh } from '../../../lib/format';

export const ADJUSTMENT_LABELS: Record<AdjustmentType, string> = {
  deposit: '💰 Deposit',
  bonus: '🎁 Bonus/Cashback',
  refund: '🔄 Refund',
  adjustment: '⚙️ Balance Adjustment',
};

export function AddBalancePage() {
  useLanguage();
  const me = useMe();
  const { id } = useParams();
  const userId = Number(id);
  const user = useAdminUser(Number.isFinite(userId) ? userId : undefined);
  const adjustments = useUserAdjustments(Number.isFinite(userId) ? userId : undefined);
  const add = useAddBalance();
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<AdjustmentType>('deposit');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [confirming, setConfirming] = useState(false);

  if (!Number.isFinite(userId) || userId <= 0) return <Navigate to="/admin/users" replace />;
  if (user.isPending) return <Spinner />;
  if (user.isError || !user.data) return <Navigate to="/admin/users" replace />;
  const u = user.data;
  const value = Number(amount) || 0;
  const name = me.data?.name ?? 'Administrator';

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    const r = addBalanceSchema.safeParse({ amount: Number(amount), type, reason });
    if (!r.success) {
      setError(r.error.issues.map((i) => i.message).join('\n'));
      return;
    }
    setConfirming(true);
  }

  function submit() {
    setConfirming(false);
    add.mutate(
      { id: u.id, amount: Number(amount), type, reason: reason.trim() },
      {
        onSuccess: (r) => {
          setMessage(r.message);
          setAmount('');
          setReason('');
        },
        onError: (err) => setError(err.message),
      },
    );
  }

  return (
    <div>
      <TopHeader
        title={tr('Add Balance to Account')}
        subtitle={tr(`Manage user funds: ${u.fullName}`)}
        name={name}
        hint={tr('Administrator')}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="flex flex-col gap-6">
          <Card title={tr('Customer')}>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-p-muted">{tr('Name')}</dt>
              <dd className="font-semibold">{u.fullName}</dd>
              <dt className="text-p-muted">{tr('Email')}</dt>
              <dd>{u.email}</dd>
              <dt className="text-p-muted">{tr('Phone')}</dt>
              <dd>{u.phone}</dd>
              <dt className="text-p-muted">{tr('Current Balance')}</dt>
              <dd className="text-lg font-bold text-p-primary">{formatTsh(u.balance)}</dd>
            </dl>
            <Link
              to="/admin/users"
              className="mt-4 inline-block text-sm font-semibold text-p-primary"
            >
              {tr('← Back to Users')}
            </Link>
          </Card>

          <Card title={tr('Add funds')}>
            {message && (
              <Alert kind="success" className="mb-4">
                {tr(message)}
              </Alert>
            )}
            {error && (
              <Alert kind="error" className="mb-4">
                {tr(error)}
              </Alert>
            )}
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <Input
                label={tr('Amount (TSh) *')}
                type="number"
                step="0.01"
                min="1"
                max={FRAUD.MAX_ADMIN_ADJUSTMENT}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                hint={tr('Min: TSh 1 | Max: TSh 10,000,000 per transaction')}
                required
              />
              <Select
                label={tr('Transaction Type *')}
                value={type}
                onChange={(e) => setType(e.target.value as AdjustmentType)}
              >
                {ADJUSTMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {tr(ADJUSTMENT_LABELS[t])}
                  </option>
                ))}
              </Select>
              <Textarea
                label={tr('Reason *')}
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                hint={tr('At least 10 characters; recorded in the audit log')}
                required
              />
              <div className="rounded-lg bg-p-bg p-4 text-sm">
                <div className="mb-2 font-bold text-p-dark">{tr('Preview')}</div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                  <dt className="text-p-muted">{tr('Customer')}</dt>
                  <dd>{u.fullName}</dd>
                  <dt className="text-p-muted">{tr('Current Balance')}</dt>
                  <dd>{formatTsh(u.balance)}</dd>
                  <dt className="text-p-muted">{tr('Amount to Add')}</dt>
                  <dd className="text-p-success">+{formatTsh(value)}</dd>
                  <dt className="text-p-muted">{tr('New Balance')}</dt>
                  <dd className="font-bold">{formatTsh(u.balance + value)}</dd>
                </dl>
              </div>
              <Button type="submit" variant="success" loading={add.isPending}>
                {tr('💰 Add Balance')}
              </Button>
            </form>
          </Card>
        </div>

        <Card title={tr('Recent Balance Adjustments')}>
          {adjustments.isPending && <Spinner />}
          {adjustments.data && adjustments.data.length === 0 && (
            <EmptyState icon="📭" title={tr('No adjustments yet')} />
          )}
          {adjustments.data && adjustments.data.length > 0 && (
            <Table>
              <thead>
                <tr>
                  <Th>{tr('Date')}</Th>
                  <Th>{tr('Transaction ID')}</Th>
                  <Th>{tr('Amount')}</Th>
                  <Th>{tr('Type')}</Th>
                  <Th>{tr('Reason')}</Th>
                </tr>
              </thead>
              <tbody>
                {adjustments.data.map((a) => (
                  <tr key={a.id}>
                    <Td className="whitespace-nowrap text-p-muted">
                      {formatDate(a.createdAt, 'minute')}
                    </Td>
                    <Td className="font-mono text-xs">{a.transactionId}</Td>
                    <Td className="font-semibold text-p-success">+{formatTsh(a.amount)}</Td>
                    <Td>
                      <Badge tone="blue">{a.type}</Badge>
                    </Td>
                    <Td className="text-p-muted">{a.reason}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={confirming}
        title={tr('Confirm balance adjustment')}
        body={tr(
          `Add ${formatTsh(value)} (${ADJUSTMENT_LABELS[type]}) to ${u.fullName}'s account?\n\nReason: ${reason.trim()}\nNew balance: ${formatTsh(u.balance + value)}`,
        )}
        confirmText={tr('Add Balance')}
        onConfirm={submit}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
