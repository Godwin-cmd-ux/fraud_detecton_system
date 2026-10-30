import { useLanguage, translate as tr } from '../../../i18n';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import type { TransactionListItem, TransactionStatus } from '@fraud/shared';
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
import { TransactionDetailsModal, TransactionLabel } from '../components/TransactionDetailsModal';
import { UnlockOverlay } from '../components/UnlockOverlay';

export function UserTransactionsPage() {
  useLanguage();
  const [params, setParams] = useSearchParams();
  const search = params.get('search') ?? '';
  const status = (params.get('status') ?? '') as TransactionStatus | '';
  const fraud = (params.get('fraud') ?? '') as 'fraud' | 'legit' | 'pending' | '';
  const page = Number(params.get('page') ?? '1') || 1;
  const query = useUserTransactions({
    search: search || undefined,
    status: status || undefined,
    fraud: fraud || undefined,
    page,
  });
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

  return (
    <div>
      <TopHeader
        title={tr('Transaction History')}
        subtitle={tr('All your transfers, withdrawals and deposits')}
        actions={
          query.data && !query.data.locked ? (
            <Button variant="secondary" size="sm" onClick={() => setConfirmLock(true)}>
              {tr('Lock')}
            </Button>
          ) : null
        }
      />

      {query.isPending && <Spinner />}
      {query.isError && <Alert kind="error">{tr('Could not load transactions.')}</Alert>}
      {query.data?.locked && <UnlockOverlay />}

      {query.data && !query.data.locked && (
        <Card
          title={tr(`Transactions (${query.data.total})`)}
          actions={
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                update({ search: searchDraft });
              }}
            >
              <Input
                placeholder={tr('Search ID or message')}
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                aria-label={tr('Search')}
              />
              <Select
                aria-label={tr('Status')}
                value={status}
                onChange={(e) => update({ status: e.target.value })}
              >
                <option value="">{tr('All statuses')}</option>
                <option value="SUCCESS">{tr('Success')}</option>
                <option value="ABORTED">{tr('Aborted')}</option>
                <option value="PENDING">{tr('Pending')}</option>
              </Select>
              <Select
                aria-label={tr('Fraud filter')}
                value={fraud}
                onChange={(e) => update({ fraud: e.target.value })}
              >
                <option value="">{tr('All predictions')}</option>
                <option value="fraud">{tr('Fraud')}</option>
                <option value="legit">{tr('Legit')}</option>
                <option value="pending">{tr('Pending')}</option>
              </Select>
              <Button type="submit" size="sm" variant="secondary">
                {tr('Search')}
              </Button>
              {hasFilters && (
                <Link
                  to="/app/transactions"
                  className="card-link"
                  onClick={() => setSearchDraft('')}
                >
                  {tr('Clear')}
                </Link>
              )}
            </form>
          }
        >
          {query.data.items.length === 0 ? (
            <EmptyState icon="inbox" title={tr('No transactions found')} />
          ) : (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>{tr('ID')}</Th>
                    <Th>{tr('Type')}</Th>
                    <Th>{tr('Amount')}</Th>
                    <Th>{tr('Status')}</Th>
                    <Th>{tr('Risk Score')}</Th>
                    <Th>{tr('Risk Level')}</Th>
                    <Th>{tr('Date')}</Th>
                    <Th></Th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.items.map((t) => (
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
                        {t.fraudScore > 0 ? (
                          <span
                            className="font-semibold"
                            style={{ color: riskColor(t.fraudScore) }}
                          >
                            {t.fraudScore}%
                          </span>
                        ) : (
                          <span className="text-p-muted">—</span>
                        )}
                      </Td>
                      <Td>
                        <RiskBadge level={t.riskLevel} />
                      </Td>
                      <Td className="whitespace-nowrap text-p-muted">
                        {formatDate(t.createdAt, 'minute')}
                      </Td>
                      <Td>
                        <Button size="sm" variant="ghost" onClick={() => setSelected(t)}>
                          {tr('View')}
                        </Button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <div className="mt-4">
                <Pagination
                  page={query.data.page}
                  totalPages={query.data.totalPages}
                  onChange={(p) => update({ page: String(p) })}
                />
              </div>
            </>
          )}
        </Card>
      )}

      <TransactionDetailsModal transaction={selected} onClose={() => setSelected(null)} />
      <ConfirmDialog
        open={confirmLock}
        title={tr('Lock transactions?')}
        body={tr('You will need to enter your password again to view them.')}
        confirmText={tr('Lock')}
        onConfirm={() => {
          setConfirmLock(false);
          lock.mutate();
        }}
        onCancel={() => setConfirmLock(false)}
      />
    </div>
  );
}
