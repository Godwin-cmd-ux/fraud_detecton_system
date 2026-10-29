import { useState } from 'react';
import type { AdminUserRow } from '@fraud/shared';
import { usePendingUsers, useRejectUser, useUserAction } from '../../../api/admin';
import { useMe } from '../../../api/auth';
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
  const me = useMe();
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
    if (pending.kind === 'approve') approve.mutate({ id: pending.user.id, action: 'approve', reason: reason || undefined }, { onSuccess: done, onError: fail });
    else reject.mutate({ id: pending.user.id, reason }, { onSuccess: done, onError: fail });
    setPending(null);
  }

  const name = me.data?.name ?? 'Administrator';
  const list = pendingUsers.data ?? [];

  return (
    <div>
      <TopHeader title="👥 User Approvals" subtitle="Review and approve pending user registrations" name={name} hint="Administrator" />
      {flash && (
        <Alert kind={flash.kind} className="mb-4">
          {flash.text}
        </Alert>
      )}
      <Card title={`⏳ Pending Approvals (${list.length})`}>
        {pendingUsers.isPending && <Spinner />}
        {pendingUsers.isError && <Alert kind="error">Could not load pending users.</Alert>}
        {pendingUsers.data && list.length === 0 && (
          <EmptyState icon="✅" title="No pending approvals">
            All users have been reviewed
          </EmptyState>
        )}
        {list.length > 0 && (
          <Table>
            <thead>
              <tr>
                <Th>ID</Th>
                <Th>Full Name</Th>
                <Th>Email</Th>
                <Th>Phone</Th>
                <Th>Registered</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id}>
                  <Td>{u.id}</Td>
                  <Td className="font-medium">{u.fullName}</Td>
                  <Td>{u.email}</Td>
                  <Td>{u.phone}</Td>
                  <Td className="whitespace-nowrap text-p-muted">{formatDate(u.createdAt, 'minute')}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="success" onClick={() => setPending({ kind: 'approve', user: u })}>
                        Approve
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => setPending({ kind: 'reject', user: u })}>
                        Reject
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setViewing(u)}>
                        View
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
        title="Approve user"
        body={pending ? `Are you sure you want to approve ${pending.user.fullName}?` : ''}
        confirmText="Approve"
        loading={approve.isPending}
        onConfirm={run}
        onCancel={() => setPending(null)}
      />
      <ReasonModal
        open={pending?.kind === 'reject'}
        title="Reject user"
        body={
          pending ? (
            <span>
              ⚠️ <strong>This action cannot be undone.</strong> {pending.user.fullName}'s registration will be deleted.
            </span>
          ) : (
            ''
          )
        }
        reasonRequired
        confirmText="Reject"
        danger
        loading={reject.isPending}
        onConfirm={run}
        onCancel={() => setPending(null)}
      />
      <Modal open={viewing !== null} onClose={() => setViewing(null)} title="👁️ Registration details" footer={<Button variant="secondary" onClick={() => setViewing(null)}>Close</Button>}>
        {viewing && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt className="text-p-muted">Full Name</dt>
            <dd className="font-medium">{viewing.fullName}</dd>
            <dt className="text-p-muted">Email</dt>
            <dd>{viewing.email}</dd>
            <dt className="text-p-muted">Phone</dt>
            <dd>{viewing.phone}</dd>
            <dt className="text-p-muted">Card</dt>
            <dd className="font-mono">****{viewing.cardLast4}</dd>
            <dt className="text-p-muted">Status</dt>
            <dd>{viewing.isApproved ? 'Approved' : 'Pending Approval'}</dd>
            <dt className="text-p-muted">Registered</dt>
            <dd>{formatDate(viewing.createdAt, 'long')}</dd>
          </dl>
        )}
      </Modal>
    </div>
  );
}
