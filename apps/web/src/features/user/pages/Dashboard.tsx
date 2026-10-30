import { Eye, EyeOff, ArrowUpRight, ArrowDownToLine, ArrowLeftRight } from 'lucide-react';
import { useLanguage, translate as tr } from '../../../i18n';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';
import { useDashboard, useVerifyPassword } from '../../../api/me';
import { TopHeader } from '../../../components/layout/TopHeader';
import { Alert } from '../../../components/ui/Alert';
import { RiskBadge, StatusBadge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Spinner } from '../../../components/ui/Spinner';
import { StatCard, StatGrid } from '../../../components/ui/StatCard';
import { Card, EmptyState, Table, Td, Th } from '../../../components/ui/Table';
import { formatDate, formatTsh } from '../../../lib/format';
import { ChangePasswordCard } from '../components/ChangePasswordCard';
import { TransactionLabel } from '../components/TransactionDetailsModal';

const MASK = '••••••••••••••••';

export function UserDashboardPage() {
  useLanguage();
  const dashboard = useDashboard();
  const verify = useVerifyPassword();
  const [askPassword, setAskPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [hidden, setHidden] = useState(false);

  if (dashboard.isPending) return <Spinner />;
  if (dashboard.isError || !dashboard.data)
    return <Alert kind="error">{tr('Could not load your dashboard. Please refresh.')}</Alert>;
  const d = dashboard.data;
  const revealed = d.balance !== null && !hidden;

  function onBalanceClick() {
    if (d.balance !== null) {
      setHidden((v) => !v);
      return;
    }
    setError('');
    setPassword('');
    setAskPassword(true);
  }

  function submitPassword(e: FormEvent) {
    e.preventDefault();
    setError('');
    verify.mutate(password, {
      onSuccess: (r) => {
        if (r.ok) {
          setAskPassword(false);
          setHidden(false);
        } else {
          setError('Incorrect password. Please try again.');
        }
      },
      onError: (err) => setError(err.message),
    });
  }

  return (
    <div>
      <TopHeader title={tr('Dashboard')} subtitle={tr(`Welcome back, ${d.user.fullName}!`)} />

      {d.fraud.fraud > 0 && (
        <Alert kind="warning" className="mb-6">
          <strong>{tr('Security alert:')}</strong> {d.fraud.fraud}
          {tr(' of your transactions were flagged as suspicious.')}
          {tr(' ')}
          <Link
            to="/app/transactions?fraud=fraud"
            className="font-semibold text-warn underline underline-offset-2"
          >
            {tr('Review them')}
          </Link>
        </Alert>
      )}

      <div className="balance-card mb-6 grid gap-7 rounded-card p-6 text-white sm:p-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium tracking-[0.12em] text-white/65 uppercase">
              {tr('Available Balance')}
            </span>
            <span className="tabular rounded-md border border-white/12 px-2 py-0.5 font-mono text-[11px] text-white/60">
              •••• {d.user.cardLast4}
            </span>
          </div>
          <button
            type="button"
            onClick={onBalanceClick}
            aria-label={tr(revealed ? 'Hide balance' : 'Reveal balance')}
            className="balance-amount group mt-3 flex items-center gap-3 text-left text-[2.1rem] leading-tight font-semibold tracking-tight"
          >
            <span key={revealed ? 'shown' : 'masked'}>
              {revealed ? formatTsh(d.balance ?? 0) : MASK}
            </span>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/8 text-white/70 transition group-hover:bg-white/15 group-hover:text-white">
              {revealed ? (
                <EyeOff size={16} aria-hidden="true" />
              ) : (
                <Eye size={16} aria-hidden="true" />
              )}
            </span>
          </button>
          <div className="mt-2 text-xs text-white/55">
            {tr(
              revealed
                ? 'Visible'
                : d.balance === 0
                  ? 'Your balance is empty'
                  : 'Click the balance amount to reveal',
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link
            to="/app/send"
            className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-s-teal px-4 text-sm font-medium text-s-bg transition hover:bg-[#c6e8d0] active:scale-[0.98]"
          >
            <ArrowUpRight size={17} aria-hidden="true" />
            {tr('Send Money')}
          </Link>
          <Link
            to="/app/withdraw"
            className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-white/15 px-4 text-sm font-medium text-white transition hover:border-white/30 hover:bg-white/5 active:scale-[0.98]"
          >
            <ArrowDownToLine size={17} aria-hidden="true" />
            {tr('Withdraw')}
          </Link>
          <Link
            to="/app/transactions"
            className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-white/15 px-4 text-sm font-medium text-white transition hover:border-white/30 hover:bg-white/5 active:scale-[0.98]"
          >
            <ArrowLeftRight size={17} aria-hidden="true" />
            {tr('View Transactions')}
          </Link>
        </div>
      </div>

      <StatGrid>
        <StatCard label={tr('Total Transactions')} value={d.stats.total} icon="activity" />
        <StatCard label={tr('Successful')} value={d.stats.successful} icon="success" tone="green" />
        <StatCard label={tr('Aborted')} value={d.stats.aborted} icon="failed" tone="red" />
        <StatCard
          label={tr('Success Rate')}
          value={`${d.stats.successRate}%`}
          icon="trend"
          tone="purple"
        />
        {d.fraud.analyzed > 0 && (
          <StatCard
            label={tr('Fraud Analysis')}
            value={d.fraud.fraud > 0 ? 'Suspicious Activity' : 'Safe'}
            sub={tr(
              `${d.fraud.analyzed} analyzed · avg ${d.fraud.avgScore.toFixed(1)}% · Highest: ${d.fraud.maxScore}%`,
            )}
            icon="fraud"
            tone={d.fraud.fraud > 0 ? 'amber' : 'green'}
          />
        )}
      </StatGrid>

      <Card
        className="mt-6"
        title={tr('Recent Transactions')}
        actions={
          <Link to="/app/transactions" className="card-link">
            {tr('View All →')}
          </Link>
        }
      >
        {d.recent.length === 0 ? (
          <EmptyState icon="inbox" title={tr('No transactions yet')} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{tr('ID')}</Th>
                <Th>{tr('Type')}</Th>
                <Th>{tr('Amount')}</Th>
                <Th>{tr('Status')}</Th>
                <Th>{tr('Risk')}</Th>
                <Th>{tr('Date')}</Th>
              </tr>
            </thead>
            <tbody>
              {d.recent.map((t) => (
                <tr key={t.id}>
                  <Td className="font-mono text-xs">{t.transactionId}</Td>
                  <Td>
                    <TransactionLabel t={t} />
                  </Td>
                  <Td className="font-semibold">{formatTsh(t.amount)}</Td>
                  <Td>
                    <StatusBadge status={t.status} />
                  </Td>
                  <Td>
                    <RiskBadge level={t.riskLevel} />
                  </Td>
                  <Td className="whitespace-nowrap text-p-muted">
                    {formatDate(t.createdAt, 'minute')}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <ChangePasswordCard />

      <Modal
        open={askPassword}
        onClose={() => setAskPassword(false)}
        title={tr('Verify your password')}
        size="sm"
      >
        <form onSubmit={submitPassword} className="flex flex-col gap-3">
          <p className="text-p-muted">
            {tr('Enter your account password to reveal your balance.')}
          </p>
          <Input
            label={tr('Password')}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            autoFocus
          />
          {error && <Alert kind="error">{tr(error)}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAskPassword(false)}>
              {tr('Cancel')}
            </Button>
            <Button type="submit" loading={verify.isPending}>
              {tr('Verify')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
