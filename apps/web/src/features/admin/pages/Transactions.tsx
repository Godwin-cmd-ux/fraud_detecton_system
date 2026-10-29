import { useLanguage, translate as tr } from '../../../i18n';
import { adminTransactionsQuerySchema } from '@fraud/shared';
import { useAdminTransactions } from '../../../api/admin';
import { Alert } from '../../../components/ui/Alert';
import { Pagination } from '../../../components/ui/Pagination';
import { Spinner } from '../../../components/ui/Spinner';
import { Card, EmptyState } from '../../../components/ui/Table';
import {
  MonitoringFilters,
  MonitoringHeader,
  useMonitoringFilters,
} from '../components/Monitoring';
import { TransactionsTable } from '../components/TransactionsTable';

export function AdminTransactionsPage() {
  useLanguage();
  const { params, update } = useMonitoringFilters();
  const parsed = adminTransactionsQuerySchema.safeParse(Object.fromEntries(params));
  const query = useAdminTransactions(parsed.success ? parsed.data : { page: 1 });
  return (
    <div>
      <MonitoringHeader title={tr('Transaction Monitoring')} />
      <Card title={tr('Transactions')}>
        <MonitoringFilters
          fields={[
            { key: 'search', label: 'Search' },
            { key: 'status', label: 'Status', options: ['SUCCESS', 'ABORTED', 'PENDING'] },
            { key: 'type', label: 'Type', options: ['transfer', 'deposit', 'withdrawal'] },
            { key: 'riskLevel', label: 'Risk level', options: ['HIGH', 'MEDIUM', 'LOW'] },
            { key: 'fraud', label: 'Fraud prediction', options: ['fraud', 'legit', 'pending'] },
          ]}
        />
        {!parsed.success && (
          <Alert kind="error">{tr('Invalid filters. Clear Filters to try again.')}</Alert>
        )}
        {query.isPending && <Spinner />}
        {query.isError && <Alert kind="error">{tr('Could not load transactions.')}</Alert>}
        {query.data && (
          <>
            {query.data.items.length ? (
              <TransactionsTable items={query.data.items} />
            ) : (
              <EmptyState title={tr('No transactions found')} />
            )}
            <Pagination
              page={query.data.page}
              totalPages={query.data.totalPages}
              onChange={(page) => update('page', String(page))}
            />
          </>
        )}
      </Card>
    </div>
  );
}
