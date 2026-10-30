import {
  Eye,
  EyeOff,
  ArrowUpRight,
  ArrowDownToLine,
  ArrowLeftRight,
  ShieldCheck,
  Wifi,
} from 'lucide-react';
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
import type { UserDashboard } from '../../../api/types';
import { formatDate, formatTsh } from '../../../lib/format';
import { ChangePasswordCard } from '../components/ChangePasswordCard';
import { TransactionLabel } from '../components/TransactionDetailsModal';

const MASK = '••••••••••••••••';

/**
 * The card issued to the account, drawn at the real thing's proportions (85.6 x 53.98 mm, so
 * 1.586:1) with a two-tone gradient, chip, contactless mark and the holder's name.
 */
function VirtualCard({ card, holder }: { card: UserDashboard['user']['card']; holder: string }) {
  useLanguage();
  const [revealed, setRevealed] = useState(false);
  const groups = revealed
    ? (card.number.match(/.{4}/g) ?? [])
    : ['••••', '••••', '••••', card.number.slice(-4)];
  const micro = 'text-[8px] font-medium tracking-[0.2em] text-white/55 uppercase';
  return (
    <div className="w-full max-w-[400px]">
      {/* 1.586:1 keeps the card looking like the plastic it represents on every width. */}
      <div
        className="relative flex aspect-[1.586/1] w-full flex-col overflow-hidden rounded-[18px] px-5 py-4 text-white ring-1 ring-white/25 shadow-[0_26px_50px_-22px_rgba(0,0,0,0.9)] sm:rounded-[20px] sm:px-6 sm:py-5"
        style={{
          background: 'linear-gradient(125deg, #06211f 0%, #0e2a2c 32%, #14524a 66%, #1d7550 100%)',
        }}
      >
        {/* Depth: two soft light pools plus a faint engraved pattern. */}
        <span className="pointer-events-none absolute -top-14 -right-10 h-44 w-44 rounded-full bg-[#b3dcc0]/25 blur-2xl" />
        <span className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-[#2b9c6c]/35 blur-2xl" />
        <span
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(115deg, #ffffff 0 1px, transparent 1px 10px)',
          }}
        />

        <div className="relative flex items-start justify-between">
          <span className="flex items-center gap-1.5 text-[13px] font-semibold tracking-tight">
            <ShieldCheck size={14} aria-hidden="true" />
            Sentinel
          </span>
          <span className="rounded-full border border-white/25 px-2 py-0.5 text-[8px] font-semibold tracking-[0.18em] uppercase">
            {tr('Virtual')}
          </span>
        </div>

        <div className="relative mt-3 flex items-center gap-2.5 sm:mt-4">
          {/* Chip: brushed-gold gradient with the usual contact pads. */}
          <span className="relative flex h-6 w-8 items-center justify-center overflow-hidden rounded-[5px] bg-[linear-gradient(135deg,#f8ecc0_0%,#d9b968_45%,#a9822f_100%)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)] sm:h-7 sm:w-9">
            <span className="absolute inset-x-1 top-1/2 h-px bg-[#8a6a24]/60" />
            <span className="absolute inset-y-1 left-1/2 w-px bg-[#8a6a24]/60" />
          </span>
          <Wifi size={16} className="rotate-90 opacity-70" aria-hidden="true" />
        </div>

        <div className="tabular relative mt-3 flex items-center font-mono text-[15px] tracking-[0.12em] sm:mt-4 sm:text-[18px]">
          {groups.map((group, index) => (
            <span key={index} className="mr-2.5 last:mr-0 sm:mr-3">
              {group}
            </span>
          ))}
        </div>

        <div className="relative mt-auto flex items-end justify-between gap-3 pt-2">
          <div className="min-w-0">
            <div className={micro}>{tr('Card holder')}</div>
            <div className="truncate text-[11px] font-medium tracking-[0.08em] uppercase">
              {holder}
            </div>
          </div>
          <div className="shrink-0">
            <div className={micro}>{tr('Expires')}</div>
            <div className="tabular font-mono text-[11px]">{card.expiry ?? '—'}</div>
          </div>
          <div className="shrink-0">
            <div className={micro}>{tr('CVC')}</div>
            <div className="tabular font-mono text-[11px]">
              {revealed ? (card.cvc ?? '•••') : '•••'}
            </div>
          </div>
          <span className="shrink-0 text-[15px] font-bold italic tracking-tight text-white/90">
            VISA
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setRevealed((v) => !v)}
        className="mt-2.5 inline-flex items-center gap-1.5 rounded-md px-0.5 text-[11px] font-medium text-white/60 transition hover:text-white"
      >
        {revealed ? <EyeOff size={13} aria-hidden="true" /> : <Eye size={13} aria-hidden="true" />}
        {tr(revealed ? 'Hide card details' : 'Show card details')}
      </button>
    </div>
  );
}

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

      <div className="balance-card mb-6 grid gap-6 rounded-card p-5 text-white sm:p-6 lg:grid-cols-[minmax(0,380px)_1fr] lg:items-center lg:gap-10 lg:p-7">
        {d.user.card && <VirtualCard card={d.user.card} holder={d.user.fullName} />}

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium tracking-[0.12em] text-white/65 uppercase">
              {tr('Available Balance')}
            </span>
            <span className="tabular rounded-md border border-white/12 px-2 py-0.5 font-mono text-[11px] text-white/60">
              •••• {d.user.card?.number.slice(-4) ?? ''}
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
          <div className="mt-5 flex flex-wrap gap-2.5">
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
