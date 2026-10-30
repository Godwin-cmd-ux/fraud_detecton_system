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
import { describeTransaction } from '../components/TransactionDetailsModal';

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
          setError('❌ Incorrect password. Please try again.');
        }
      },
      onError: (err) => setError(err.message),
    });
  }

  return (
    <div>
      <TopHeader
        title={tr('Dashboard')}
        subtitle={tr(`Welcome back, ${d.user.fullName}!`)}
        name={d.user.fullName}
        hint={tr('Customer account')}
      />

      {d.fraud.fraud > 0 && (
        <Alert kind="warning" className="mb-6">
          <strong>{tr('🚨 Security alert:')}</strong> {d.fraud.fraud}
          {tr(' of your transactions were flagged as suspicious.')}
          {tr(' ')}
          <Link to="/app/transactions?fraud=fraud" className="font-semibold underline">
            {tr('Review them')}
          </Link>
        </Alert>
      )}

      <div className="mb-6 rounded-card border border-p-border bg-gradient-to-r from-p-primary to-p-primary-dark p-6 text-white shadow-sm">
        <div className="text-xs font-semibold tracking-wide uppercase opacity-80">
          {tr('Available Balance')}
        </div>
        <button
          type="button"
          onClick={onBalanceClick}
          aria-label={tr(revealed ? 'Hide balance' : 'Reveal balance')}
          className="mt-2 flex items-center gap-3 text-left text-3xl font-bold tracking-wide"
        >
          <span>{revealed ? formatTsh(d.balance ?? 0) : MASK}</span>
          <span className="text-xl">{tr(revealed ? '🔓' : '🔒')}</span>
        </button>
        <div className="mt-2 text-xs opacity-80">
          {tr(
            revealed
              ? '👁️ Visible'
              : d.balance === 0
                ? 'Your balance is empty'
                : 'Click the balance amount to reveal',
          )}
        </div>
      </div>

      <StatGrid>
        <StatCard label={tr('Total Transactions')} value={d.stats.total} icon="📊" />
        <StatCard label={tr('Successful')} value={d.stats.successful} icon="✅" tone="green" />
        <StatCard label={tr('Aborted')} value={d.stats.aborted} icon="❌" tone="red" />
        <StatCard
          label={tr('Success Rate')}
          value={`${d.stats.successRate}%`}
          icon="📈"
          tone="purple"
        />
        {d.fraud.analyzed > 0 && (
          <StatCard
            label={tr('Fraud Analysis')}
            value={d.fraud.fraud > 0 ? '⚠️ Suspicious Activity' : '✅ Safe'}
            sub={tr(
              `${d.fraud.analyzed} analyzed · avg ${d.fraud.avgScore.toFixed(1)}% · Highest: ${d.fraud.maxScore}%`,
            )}
            tone={d.fraud.fraud > 0 ? 'amber' : 'green'}
          />
        )}
      </StatGrid>

      <div className="my-6 flex flex-wrap gap-3">
        <Link to="/app/send">
          <Button>{tr('💸 Send Money')}</Button>
        </Link>
        <Link to="/app/withdraw">
          <Button variant="success">{tr('🏧 Withdraw')}</Button>
        </Link>
        <Link to="/app/transactions">
          <Button variant="secondary">{tr('📜 View Transactions')}</Button>
        </Link>
      </div>

      <Card
        title={tr('Recent Transactions')}
        actions={
          <Link to="/app/transactions" className="text-sm font-semibold text-p-primary">
            {tr('View All →')}
          </Link>
        }
      >
        {d.recent.length === 0 ? (
          <EmptyState icon="📭" title={tr('No transactions yet')} />
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
                  <Td>{tr(describeTransaction(t, 'dashboard'))}</Td>
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

      <Modal
        open={askPassword}
        onClose={() => setAskPassword(false)}
        title={tr('🔐 Verify your password')}
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
