import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import type { AdminUserRow } from '@fraud/shared';
import { useAdminUsers, useDeleteUser, useUserAction } from '../../../api/admin';
import type { UserAction } from '../../../api/admin';
import { useMe } from '../../../api/auth';
import { TopHeader } from '../../../components/layout/TopHeader';
import { Alert } from '../../../components/ui/Alert';
import type { AlertKind } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Input } from '../../../components/ui/Input';
import { Pagination } from '../../../components/ui/Pagination';
import { Spinner } from '../../../components/ui/Spinner';
import { Card, EmptyState, Table, Td, Th } from '../../../components/ui/Table';
import { formatDate, formatTsh } from '../../../lib/format';
import { UserActionButtons, UserViewModal, statusLabel } from '../components/UserViewModal';

const ACTION_TEXT: Record<UserAction, { title: (n: string) => string; body: string }> = {
  approve: { title: (n) => `Approve ${n}?`, body: 'The user will be able to sign in.' },
  disapprove: { title: (n) => `Disapprove ${n}?`, body: 'The user will no longer be able to sign in until approved again.' },
  activate: { title: (n) => `Activate ${n}?`, body: 'The account will be reactivated.' },
  deactivate: { title: (n) => `Deactivate ${n}?`, body: 'The user will be signed out and unable to sign in.' },
};

type Pending = { kind: 'action'; action: UserAction; user: AdminUserRow } | { kind: 'delete'; user: AdminUserRow } | null;

export function AdminUsersPage() {
  const me = useMe();
  const [params, setParams] = useSearchParams();
  const search = params.get('search') ?? '';
  const page = Number(params.get('page') ?? '1') || 1;
  const [draft, setDraft] = useState(search);
  const users = useAdminUsers({ search: search || undefined, page });
  const action = useUserAction();
  const remove = useDeleteUser();
  const [viewing, setViewing] = useState<AdminUserRow | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [flash, setFlash] = useState<{ kind: AlertKind; text: string } | null>(null);

  function update(next: Record<string, string>) {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    if (!('page' in next)) p.delete('page');
    setParams(p);
  }

  function run() {
    if (!pending) return;
    const done = (r: { message: string }) => setFlash({ kind: 'success', text: r.message });
    const fail = (e: Error) => setFlash({ kind: 'error', text: e.message });
    if (pending.kind === 'delete') remove.mutate(pending.user.id, { onSuccess: done, onError: fail });
    else action.mutate({ id: pending.user.id, action: pending.action }, { onSuccess: done, onError: fail });
    setPending(null);
    setViewing(null);
  }

  const name = me.data?.name ?? 'Administrator';
  const busy = action.isPending || remove.isPending;

  return (
    <div>
      <TopHeader title="User Management" subtitle="View and manage all registered users" name={name} hint="Administrator" />
      {flash && (
        <Alert kind={flash.kind} className="mb-4">
          {flash.text}
        </Alert>
      )}

      <Card
        title="All Users"
        actions={
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              update({ search: draft });
            }}
          >
            <Input aria-label="Search users" placeholder="Search name, email or phone" value={draft} onChange={(e) => setDraft(e.target.value)} />
            <Button type="submit" size="sm" variant="secondary">
              Search
            </Button>
            {search && (
              <Link to="/admin/users" className="text-sm font-semibold text-p-primary" onClick={() => setDraft('')}>
                Clear
              </Link>
            )}
          </form>
        }
      >
        {users.isPending && <Spinner />}
        {users.isError && <Alert kind="error">Could not load users.</Alert>}
        {users.data && users.data.items.length === 0 && <EmptyState icon="👥" title="No users found" />}
        {users.data && users.data.items.length > 0 && (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>ID</Th>
                  <Th>Full Name</Th>
                  <Th>Email</Th>
                  <Th>Phone</Th>
                  <Th>Balance</Th>
                  <Th>Card</Th>
                  <Th>Status</Th>
                  <Th>Created</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {users.data.items.map((u) => {
                  const s = statusLabel(u);
                  return (
                    <tr key={u.id}>
                      <Td>{u.id}</Td>
                      <Td className="font-medium">{u.fullName}</Td>
                      <Td>{u.email}</Td>
                      <Td>{u.phone}</Td>
                      <Td className="whitespace-nowrap">{formatTsh(u.balance)}</Td>
                      <Td className="font-mono text-xs">****{u.cardLast4}</Td>
                      <Td>
                        <div className="font-semibold" style={{ color: s.color }}>
                          {s.text}
                        </div>
                        <div className="text-xs text-p-muted">{s.sub}</div>
                      </Td>
                      <Td className="text-p-muted">{formatDate(u.createdAt, 'date')}</Td>
                      <Td>
                        <div className="flex flex-wrap gap-1.5">
                          <UserActionButtons user={u} onAction={(a) => setPending({ kind: 'action', action: a, user: u })} onDelete={() => setPending({ kind: 'delete', user: u })} />
                          <Link to={`/admin/users/${u.id}/balance`}>
                            <Button size="sm">💰 Add Balance</Button>
                          </Link>
                          <Button size="sm" variant="ghost" onClick={() => setViewing(u)}>
                            👁️ View
                          </Button>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <div className="mt-4">
              <Pagination page={users.data.page} totalPages={users.data.totalPages} onChange={(p) => update({ page: String(p) })} />
            </div>
          </>
        )}
      </Card>

      <UserViewModal
        user={viewing}
        onClose={() => setViewing(null)}
        onAction={(a) => viewing && setPending({ kind: 'action', action: a, user: viewing })}
        onDelete={() => viewing && setPending({ kind: 'delete', user: viewing })}
      />
      <ConfirmDialog
        open={pending !== null}
        title={pending ? (pending.kind === 'delete' ? `Delete ${pending.user.fullName}?` : ACTION_TEXT[pending.action].title(pending.user.fullName)) : ''}
        body={
          pending
            ? pending.kind === 'delete'
              ? `⚠️ This action is permanent and cannot be undone.\n\n${pending.user.fullName} (${pending.user.email}) will be removed.`
              : ACTION_TEXT[pending.action].body
            : ''
        }
        confirmText={pending?.kind === 'delete' ? 'Delete' : 'Confirm'}
        danger={pending?.kind === 'delete' || pending?.action === 'deactivate' || pending?.action === 'disapprove'}
        loading={busy}
        onConfirm={run}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
