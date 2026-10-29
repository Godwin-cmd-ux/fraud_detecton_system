import { useState } from 'react';
import { fraudAlertsQuerySchema } from '@fraud/shared';
import { useFraudAlerts, useMarkReviewed } from '../../../api/admin';
import type { AdminTxRow } from '../../../api/types';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Pagination } from '../../../components/ui/Pagination';
import { Spinner } from '../../../components/ui/Spinner';
import { Card, EmptyState } from '../../../components/ui/Table';
import {
  MonitoringFilters,
  MonitoringHeader,
  useMonitoringFilters,
} from '../components/Monitoring';
import { TransactionsTable } from '../components/TransactionsTable';

export function FraudAlertsPage() {
  const { params, update } = useMonitoringFilters();
  const parsed = fraudAlertsQuerySchema.safeParse(Object.fromEntries(params));
  const query = useFraudAlerts(parsed.success ? parsed.data : { page: 1 });
  const review = useMarkReviewed();
  const [selected, setSelected] = useState<AdminTxRow | null>(null);
  return (
    <div>
      <MonitoringHeader title={`Fraud Alerts (${query.data?.total ?? 0})`} />
      <Card>
        <MonitoringFilters
          fields={[
            { key: 'search', label: 'Search' },
            { key: 'riskLevel', label: 'Risk level', options: ['HIGH', 'MEDIUM', 'LOW'] },
            { key: 'dateFrom', label: 'From date', type: 'date' },
            { key: 'dateTo', label: 'To date', type: 'date' },
            { key: 'reviewed', label: 'Review status', options: ['unreviewed', 'reviewed', 'all'] },
          ]}
        />
        {!parsed.success && (
          <Alert kind="error">Invalid filters. Clear Filters to try again.</Alert>
        )}
        {query.isPending && <Spinner />}
        {query.isError && <Alert kind="error">Could not load fraud alerts.</Alert>}
        {review.isError && <Alert kind="error">{review.error.message}</Alert>}
        {review.isSuccess && <Alert kind="success">{review.data.message}</Alert>}
        {query.data && (
          <>
            {query.data.items.length ? (
              <TransactionsTable
                alert
                items={query.data.items}
                actions={(row) =>
                  !row.reviewedAt && (
                    <Button
                      size="sm"
                      onClick={() => {
                        review.reset();
                        setSelected(row);
                      }}
                    >
                      Mark Reviewed
                    </Button>
                  )
                }
              />
            ) : (
              <EmptyState title="No Fraud Alerts">All transactions appear legitimate</EmptyState>
            )}
            <Pagination
              page={query.data.page}
              totalPages={query.data.totalPages}
              onChange={(page) => update('page', String(page))}
            />
          </>
        )}
        <ConfirmDialog
          open={selected !== null}
          title="Mark transaction reviewed?"
          body={selected?.transactionId}
          loading={review.isPending}
          onCancel={() => setSelected(null)}
          onConfirm={() => {
            if (selected) review.mutate(selected.id, { onSuccess: () => setSelected(null) });
          }}
        />
      </Card>
    </div>
  );
}
