import { ADJUSTMENT_TYPES, balanceAdjustmentsQuerySchema } from '@fraud/shared';
import { useAdmins, useBalanceAdjustments } from '../../../api/admin';
import type { AdjustmentLogRow } from '../../../api/types';
import { Alert } from '../../../components/ui/Alert';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Pagination } from '../../../components/ui/Pagination';
import { Select } from '../../../components/ui/Select';
import { StatCard, StatGrid } from '../../../components/ui/StatCard';
import { Spinner } from '../../../components/ui/Spinner';
import { Card, EmptyState, Table, Th, Td } from '../../../components/ui/Table';
import { formatDate, formatTsh } from '../../../lib/format';
import {
  MonitoringFilters,
  MonitoringHeader,
  useMonitoringFilters,
} from '../components/Monitoring';

export function adjustmentsCsv(rows: AdjustmentLogRow[]): string {
  const cell = (value: unknown) => {
    const text = String(value ?? '').replaceAll(',', ';');
    const safe = /^\s*[=+@-]/.test(text) ? `'${text}` : text;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  return [
    ['Transaction', 'Date', 'Customer', 'Email', 'Admin', 'Type', 'Amount', 'Reason'],
    ...rows.map((row) => [
      row.transactionId,
      row.createdAt,
      row.userName ?? 'System',
      row.userEmail,
      row.adminName ? `${row.adminName} @${row.adminUsername ?? ''}` : 'System',
      row.type,
      row.amount,
      row.reason,
    ]),
  ]
    .map((row) => row.map(cell).join(','))
    .join('\r\n');
}

export function BalanceAdjustmentsPage() {
  const { params, update } = useMonitoringFilters();
  const parsed = balanceAdjustmentsQuerySchema.safeParse(Object.fromEntries(params));
  const query = useBalanceAdjustments(parsed.success ? parsed.data : { page: 1 });
  const admins = useAdmins();
  function exportPage() {
    if (!query.data) return;
    const url = URL.createObjectURL(
      new Blob(['\uFEFF', adjustmentsCsv(query.data.items)], { type: 'text/csv;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `balance-adjustments-${new Date().toISOString().replaceAll(':', '-')}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const summary = query.data?.summary;
  return (
    <div className="space-y-5">
      <MonitoringHeader title="Balance Adjustments" />
      {summary && (
        <>
          <StatGrid>
            <StatCard label="Adjustments" value={summary.total} />
            <StatCard label="Total amount" value={formatTsh(summary.totalAmount)} />
            <StatCard label="Average amount" value={formatTsh(summary.avgAmount)} />
            <StatCard label="Customers" value={summary.uniqueUsers} />
            <StatCard label="Administrators" value={summary.uniqueAdmins} />
          </StatGrid>
          <div className="flex flex-wrap gap-2">
            {summary.byType.map((row) => (
              <Badge key={row.type} tone="blue">
                {row.type}: {row.count} · {formatTsh(row.total)}
              </Badge>
            ))}
          </div>
        </>
      )}
      <Card
        title="Adjustment Log"
        actions={
          <>
            <Button variant="secondary" disabled={!query.data} onClick={exportPage}>
              Export CSV (visible page)
            </Button>
            <Button variant="secondary" onClick={() => window.print()}>
              Print
            </Button>
          </>
        }
      >
        <MonitoringFilters
          fields={[
            { key: 'search', label: 'Search' },
            { key: 'type', label: 'Type', options: ADJUSTMENT_TYPES },
            { key: 'dateFrom', label: 'From date', type: 'date' },
            { key: 'dateTo', label: 'To date', type: 'date' },
          ]}
        />
        <label className="mb-4 block text-sm font-semibold">
          Administrator
          <Select
            aria-label="Administrator"
            value={params.get('adminId') ?? ''}
            onChange={(e) => update('adminId', e.target.value)}
          >
            <option value="">All administrators</option>
            {admins.data?.map((admin) => (
              <option value={admin.id} key={admin.id}>
                {admin.fullName} @{admin.username}
              </option>
            ))}
          </Select>
        </label>
        {admins.isError && <Alert kind="error">Could not load administrator options.</Alert>}
        {!parsed.success && (
          <Alert kind="error">Invalid filters. Clear Filters to try again.</Alert>
        )}
        {query.isPending && <Spinner />}
        {query.isError && <Alert kind="error">Could not load adjustments.</Alert>}
        {query.data && (
          <>
            {query.data.items.length ? (
              <Table>
                <thead>
                  <tr>
                    {['Transaction', 'Date', 'Customer', 'Admin', 'Type', 'Amount', 'Reason'].map(
                      (label) => (
                        <Th key={label}>{label}</Th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {query.data.items.map((row) => (
                    <tr key={row.id}>
                      <Td>{row.transactionId}</Td>
                      <Td>{formatDate(row.createdAt, 'minute')}</Td>
                      <Td>
                        {row.userName ?? 'System'}
                        <div className="text-xs text-p-muted">{row.userEmail}</div>
                      </Td>
                      <Td>
                        {row.adminName ? `${row.adminName} @${row.adminUsername ?? ''}` : 'System'}
                      </Td>
                      <Td>
                        <Badge tone="blue">{row.type}</Badge>
                      </Td>
                      <Td>{formatTsh(row.amount)}</Td>
                      <Td>{row.reason ?? 'N/A'}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <EmptyState title="No balance adjustments found" />
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
