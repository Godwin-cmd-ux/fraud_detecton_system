import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import type { TransactionListItem, TransactionStatus } from '@fraud/shared';
import { useMe } from '../../../api/auth';
import { useLockTransactions, useUserTransactions } from '../../../api/me';
import { TopHeader } from '../../../components/layout/TopHeader';
import { Alert } from '../../../components/ui/Alert';
import { RiskBadge, StatusBadge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Input } from '../../../components/ui/Input';
import { Pagination } from '../../../components/ui/Pagination';
import { Select } from '../../../components/ui/Select';
import { Spinner } from '../../../components/ui/Spinner';
import { Card, EmptyState, Table, Td, Th } from '../../../components/ui/Table';
import { formatDate, formatTsh, riskColor } from '../../../lib/format';
import { TransactionDetailsModal, describeTransaction } from '../components/TransactionDetailsModal';
import { UnlockOverlay } from '../components/UnlockOverlay';

export function UserTransactionsPage() {
  const me = useMe();
  const [params, setParams] = useSearchParams();
  const search = params.get('search') ?? '';
  const status = (params.get('status') ?? '') as TransactionStatus | '';
  const fraud = (params.get('fraud') ?? '') as 'fraud' | 'legit' | 'pending' | '';
  const page = Number(params.get('page') ?? '1') || 1;
  const query = useUserTransactions({ search: search || undefined, status: status || undefined, fraud: fraud || undefined, page });
  const lock = useLockTransactions();
  const [selected, setSelected] = useState<TransactionListItem | null>(null);
  const [confirmLock, setConfirmLock] = useState(false);
  const [searchDraft, setSearchDraft] = useState(search);

  function update(next: Record<string, string>) {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    if (!('page' in next)) p.delete('page');
    setParams(p);
  }
  const hasFilters = Boolean(search || status || fraud);
  const name = me.data?.name ?? 'Customer';

  return (
    <div>
      <TopHeader
        title="Transaction History"
        subtitle="All your transfers, withdrawals and deposits"
        name={name}
        actions={
          query.data && !query.data.locked ? (
            <Button variant="secondary" size="sm" onClick={() => setConfirmLock(true)}>
              🔒 Lock
            </Button>
          ) : null
        }
      />

      {query.isPending && <Spinner />}
      {query.isError && <Alert kind="error">Could not load transactions.</Alert>}
      {query.data?.locked && <UnlockOverlay />}

      {query.data && !query.data.locked && (
        <Card
          title={`Transactions (${query.data.total})`}
          actions={
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                update({ search: searchDraft });
              }}
            >
              <Input placeholder="Search ID or message" value={searchDraft} onChange={(e) => setSearchDraft(e.target.value)} aria-label="Search" />
              <Select aria-label="Status" value={status} onChange={(e) => update({ status: e.target.value })}>
                <option value="">All statuses</option>
                <option value="SUCCESS">Success</option>
                <option value="ABORTED">Aborted</option>
                <option value="PENDING">Pending</option>
              </Select>
              <Select aria-label="Fraud filter" value={fraud} onChange={(e) => update({ fraud: e.target.value })}>
                <option value="">All predictions</option>
                <option value="fraud">Fraud</option>
                <option value="legit">Legit</option>
                <option value="pending">Pending</option>
              </Select>
              <Button type="submit" size="sm" variant="secondary">
                Search
              </Button>
              {hasFilters && (
                <Link to="/app/transactions" className="text-sm font-semibold text-p-primary" onClick={() => setSearchDraft('')}>
                  Clear
                </Link>
              )}
            </form>
          }
        >
          {query.data.items.length === 0 ? (
            <EmptyState icon="📭" title="No transactions found" />
          ) : (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>ID</Th>
                    <Th>Type</Th>
                    <Th>Amount</Th>
                    <Th>Status</Th>
                    <Th>Risk Score</Th>
                    <Th>Risk Level</Th>
                    <Th>Date</Th>
                    <Th></Th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.items.map((t) => (
                    <tr key={t.id}>
                      <Td className="font-mono text-xs">{t.transactionId}</Td>
                      <Td>{describeTransaction(t)}</Td>
                      <Td className="font-semibold">{formatTsh(t.amount)}</Td>
                      <Td>
                        <StatusBadge status={t.status} />
                      </Td>
                      <Td>
                        {t.fraudScore > 0 ? (
                          <span className="font-semibold" style={{ color: riskColor(t.fraudScore) }}>
                            {t.fraudScore}%
                          </span>
                        ) : (
                          <span className="text-p-muted">—</span>
                        )}
                      </Td>
                      <Td>
                        <RiskBadge level={t.riskLevel} />
                      </Td>
                      <Td className="whitespace-nowrap text-p-muted">{formatDate(t.createdAt, 'minute')}</Td>
                      <Td>
                        <Button size="sm" variant="ghost" onClick={() => setSelected(t)}>
                          View
                        </Button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <div className="mt-4">
                <Pagination page={query.data.page} totalPages={query.data.totalPages} onChange={(p) => update({ page: String(p) })} />
              </div>
            </>
          )}
        </Card>
      )}

      <TransactionDetailsModal transaction={selected} onClose={() => setSelected(null)} />
      <ConfirmDialog
        open={confirmLock}
        title="Lock transactions?"
        body="You will need to enter your password again to view them."
        confirmText="Lock"
        onConfirm={() => {
          setConfirmLock(false);
          lock.mutate();
        }}
        onCancel={() => setConfirmLock(false)}
      />
    </div>
  );
}
