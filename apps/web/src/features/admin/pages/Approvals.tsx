import { useLanguage, translate as tr } from '../../../i18n';
import { useState } from 'react';
import type { AdminUserRow } from '@fraud/shared';
import { usePendingUsers, useRejectUser, useUserAction } from '../../../api/admin';
import { TopHeader } from '../../../components/layout/TopHeader';
import { Alert } from '../../../components/ui/Alert';
import type { AlertKind } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { Spinner } from '../../../components/ui/Spinner';
import { Card, EmptyState, Table, Td, Th } from '../../../components/ui/Table';
import { formatDate } from '../../../lib/format';
import { ReasonModal } from '../components/ReasonModal';

type Pending = { kind: 'approve' | 'reject'; user: AdminUserRow } | null;

export function ApprovalsPage() {
  useLanguage();
  const pendingUsers = usePendingUsers();
  const approve = useUserAction();
  const reject = useRejectUser();
  const [pending, setPending] = useState<Pending>(null);
  const [viewing, setViewing] = useState<AdminUserRow | null>(null);
  const [flash, setFlash] = useState<{ kind: AlertKind; text: string } | null>(null);

  function run(reason: string) {
    if (!pending) return;
    const done = (r: { message: string }) => setFlash({ kind: 'success', text: r.message });
    const fail = (e: Error) => setFlash({ kind: 'error', text: e.message });
    if (pending.kind === 'approve')
      approve.mutate(
        { id: pending.user.id, action: 'approve', reason: reason || undefined },
        { onSuccess: done, onError: fail },
      );
    else reject.mutate({ id: pending.user.id, reason }, { onSuccess: done, onError: fail });
    setPending(null);
  }
  const list = pendingUsers.data ?? [];

  return (
    <div>
      <TopHeader
        title={tr('User Approvals')}
        subtitle={tr('Review and approve pending user registrations')}
      />
      {flash && (
        <Alert kind={flash.kind} className="mb-4">
          {tr(flash.text)}
        </Alert>
      )}
      <Card title={tr(`Pending Approvals (${list.length})`)}>
        {pendingUsers.isPending && <Spinner />}
        {pendingUsers.isError && <Alert kind="error">{tr('Could not load pending users.')}</Alert>}
        {pendingUsers.data && list.length === 0 && (
          <EmptyState icon="success" title={tr('No pending approvals')}>
            {tr('All users have been reviewed')}
          </EmptyState>
        )}
        {list.length > 0 && (
          <Table>
            <thead>
              <tr>
                <Th>{tr('ID')}</Th>
                <Th>{tr('Full Name')}</Th>
                <Th>{tr('Email')}</Th>
                <Th>{tr('Phone')}</Th>
                <Th>{tr('Registered')}</Th>
                <Th>{tr('Actions')}</Th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id}>
                  <Td>{u.id}</Td>
                  <Td className="font-medium">{u.fullName}</Td>
                  <Td>{u.email}</Td>
                  <Td>{u.phone}</Td>
                  <Td className="whitespace-nowrap text-p-muted">
                    {formatDate(u.createdAt, 'minute')}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        size="sm"
                        variant="success"
                        onClick={() => setPending({ kind: 'approve', user: u })}
                      >
                        {tr('Approve')}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => setPending({ kind: 'reject', user: u })}
                      >
                        {tr('Reject')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setViewing(u)}>
                        {tr('View')}
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <ReasonModal
        open={pending?.kind === 'approve'}
        title={tr('Approve user')}
        body={tr(pending ? `Are you sure you want to approve ${pending.user.fullName}?` : '')}
        confirmText={tr('Approve')}
        loading={approve.isPending}
        onConfirm={run}
        onCancel={() => setPending(null)}
      />
      <ReasonModal
        open={pending?.kind === 'reject'}
        title={tr('Reject user')}
        body={tr(
          pending ? (
            <span>
              <strong>{tr('This action cannot be undone.')}</strong> {pending.user.fullName}
              {tr("'s registration will be deleted.")}
            </span>
          ) : (
            ''
          ),
        )}
        reasonRequired
        confirmText={tr('Reject')}
        danger
        loading={reject.isPending}
        onConfirm={run}
        onCancel={() => setPending(null)}
      />
      <Modal
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={tr('Registration details')}
        footer={
          <Button variant="secondary" onClick={() => setViewing(null)}>
            {tr('Close')}
          </Button>
        }
      >
        {viewing && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt className="text-p-muted">{tr('Full Name')}</dt>
            <dd className="font-medium">{viewing.fullName}</dd>
            <dt className="text-p-muted">{tr('Email')}</dt>
            <dd>{viewing.email}</dd>
            <dt className="text-p-muted">{tr('Phone')}</dt>
            <dd>{viewing.phone}</dd>
            <dt className="text-p-muted">{tr('Card')}</dt>
            <dd className="font-mono">****{viewing.cardLast4}</dd>
            <dt className="text-p-muted">{tr('Status')}</dt>
            <dd>{tr(viewing.isApproved ? 'Approved' : 'Pending Approval')}</dd>
            <dt className="text-p-muted">{tr('Registered')}</dt>
            <dd>{formatDate(viewing.createdAt, 'long')}</dd>
          </dl>
        )}
      </Modal>
    </div>
  );
}
