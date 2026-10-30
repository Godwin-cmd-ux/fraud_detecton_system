import { useLanguage, translate as tr } from '../../../i18n';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Eye, Power, Search, Trash2, UserPlus, UserX, Wallet } from 'lucide-react';
import type { AdminUserRow } from '@fraud/shared';
import { useAdminUsers, useDeleteUser, useUserAction } from '../../../api/admin';
import type { UserAction } from '../../../api/admin';
import { TopHeader } from '../../../components/layout/TopHeader';
import { Alert } from '../../../components/ui/Alert';
import { Avatar } from '../../../components/ui/Avatar';
import { Badge } from '../../../components/ui/Badge';
import type { AlertKind } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Input } from '../../../components/ui/Input';
import { Pagination } from '../../../components/ui/Pagination';
import { RowMenu } from '../../../components/ui/RowMenu';
import { Spinner } from '../../../components/ui/Spinner';
import { Card, EmptyState, Table, Td, Th } from '../../../components/ui/Table';
import { formatDate, formatTsh } from '../../../lib/format';
import { UserViewModal, statusLabel } from '../components/UserViewModal';

const ACTION_TEXT: Record<UserAction, { title: (n: string) => string; body: string }> = {
  approve: { title: (n) => `Approve ${n}?`, body: 'The user will be able to sign in.' },
  disapprove: {
    title: (n) => `Disapprove ${n}?`,
    body: 'The user will no longer be able to sign in until approved again.',
  },
  activate: { title: (n) => `Activate ${n}?`, body: 'The account will be reactivated.' },
  deactivate: {
    title: (n) => `Deactivate ${n}?`,
    body: 'The user will be signed out and unable to sign in.',
  },
};

type Pending =
  | { kind: 'action'; action: UserAction; user: AdminUserRow }
  | { kind: 'delete'; user: AdminUserRow }
  | null;

export function AdminUsersPage() {
  useLanguage();
  const [params, setParams] = useSearchParams();
  const search = params.get('search') ?? '';
  const page = Number(params.get('page') ?? '1') || 1;
  const [draft, setDraft] = useState(search);
  const navigate = useNavigate();
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
    if (pending.kind === 'delete')
      remove.mutate(pending.user.id, { onSuccess: done, onError: fail });
    else
      action.mutate(
        { id: pending.user.id, action: pending.action },
        { onSuccess: done, onError: fail },
      );
    setPending(null);
    setViewing(null);
  }
  const busy = action.isPending || remove.isPending;

  return (
    <div>
      <TopHeader
        title={tr('User Management')}
        subtitle={tr('View and manage all registered users')}
        actions={
          <Link
            to="/admin/users/new"
            className="inline-flex min-h-10 items-center gap-2 rounded-[10px] bg-p-primary px-4 text-sm font-medium text-white shadow-sm shadow-p-primary/20 transition hover:bg-p-primary-dark active:scale-[0.98]"
          >
            <UserPlus size={16} aria-hidden="true" />
            {tr('Create User')}
          </Link>
        }
      />
      {flash && (
        <Alert kind={flash.kind} className="mb-4">
          {tr(flash.text)}
        </Alert>
      )}

      <Card
        title={
          <span className="flex items-center gap-2.5">
            {tr('All Users')}
            {users.data && (
              <span className="tabular rounded-full bg-[#eef0eb] px-2 py-0.5 text-[11px] font-semibold text-p-muted">
                {users.data.total}
              </span>
            )}
          </span>
        }
        actions={
          <form
            role="search"
            className="flex w-full items-center gap-2 sm:w-auto"
            onSubmit={(e) => {
              e.preventDefault();
              update({ search: draft });
            }}
          >
            <div className="relative flex-1 sm:w-72 sm:flex-none">
              <Search
                size={15}
                className="pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2 text-p-muted"
                aria-hidden="true"
              />
              <Input
                aria-label={tr('Search users')}
                placeholder={tr('Search name, email or phone')}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button type="submit" variant="secondary">
              {tr('Search')}
            </Button>
            {search && (
              <Link to="/admin/users" className="card-link" onClick={() => setDraft('')}>
                {tr('Clear')}
              </Link>
            )}
          </form>
        }
      >
        {users.isPending && <Spinner />}
        {users.isError && <Alert kind="error">{tr('Could not load users.')}</Alert>}
        {users.data && users.data.items.length === 0 && (
          <EmptyState icon="users" title={tr('No users found')} />
        )}
        {users.data && users.data.items.length > 0 && (
          <>
            <Table className="table-cards user-table">
              <thead>
                <tr>
                  <Th>{tr('User')}</Th>
                  <Th>{tr('Phone')}</Th>
                  <Th className="text-right">{tr('Balance')}</Th>
                  <Th>{tr('Card')}</Th>
                  <Th>{tr('Status')}</Th>
                  <Th>{tr('Created')}</Th>
                  <Th className="text-right">{tr('Actions')}</Th>
                </tr>
              </thead>
              <tbody key={`${search}-${page}`} className="row-stagger">
                {users.data.items.map((u) => {
                  const s = statusLabel(u);
                  const primary: UserAction | null = !u.isActive
                    ? 'activate'
                    : !u.isApproved
                      ? 'approve'
                      : null;
                  return (
                    <tr key={u.id}>
                      <Td className="cell-user">
                        <button
                          type="button"
                          onClick={() => setViewing(u)}
                          className="group flex items-center gap-3 text-left"
                        >
                          <Avatar name={u.fullName} />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-p-dark group-hover:text-p-primary">
                              {u.fullName}
                            </span>
                            <span className="block truncate text-xs text-p-muted">{u.email}</span>
                          </span>
                        </button>
                      </Td>
                      <Td label="Phone" className="tabular text-p-text">
                        {u.phone}
                      </Td>
                      <Td label="Balance" className="tabular text-right font-medium text-p-dark">
                        {formatTsh(u.balance)}
                      </Td>
                      <Td label="Card" className="font-mono text-xs text-p-muted">
                        ****{u.cardLast4}
                      </Td>
                      <Td className="cell-status">
                        <span title={tr(s.sub)}>
                          <Badge tone={s.tone} dot>
                            {tr(s.text)}
                          </Badge>
                        </span>
                      </Td>
                      <Td label="Created" className="text-p-muted">
                        {formatDate(u.createdAt, 'date')}
                      </Td>
                      <Td className="cell-actions">
                        <div className="flex items-center justify-end gap-1.5">
                          {primary && (
                            <Button
                              size="sm"
                              variant="success"
                              onClick={() =>
                                setPending({ kind: 'action', action: primary, user: u })
                              }
                            >
                              {tr(primary === 'approve' ? 'Approve' : 'Activate')}
                            </Button>
                          )}
                          <Button size="sm" variant="secondary" onClick={() => setViewing(u)}>
                            <Eye size={14} aria-hidden="true" />
                            {tr('View')}
                          </Button>
                          <RowMenu
                            label={tr(`More actions for ${u.fullName}`)}
                            items={[
                              {
                                label: 'Add Balance',
                                icon: <Wallet size={14} />,
                                onSelect: () => navigate(`/admin/users/${u.id}/balance`),
                              },
                              ...(u.isApproved && u.isActive
                                ? [
                                    {
                                      label: 'Disapprove',
                                      icon: <UserX size={14} />,
                                      onSelect: () =>
                                        setPending({
                                          kind: 'action',
                                          action: 'disapprove',
                                          user: u,
                                        }),
                                    },
                                  ]
                                : []),
                              ...(u.isActive
                                ? [
                                    {
                                      label: 'Deactivate',
                                      icon: <Power size={14} />,
                                      onSelect: () =>
                                        setPending({
                                          kind: 'action',
                                          action: 'deactivate',
                                          user: u,
                                        }),
                                    },
                                  ]
                                : []),
                              {
                                label: 'Delete',
                                icon: <Trash2 size={14} />,
                                danger: true,
                                onSelect: () => setPending({ kind: 'delete', user: u }),
                              },
                            ]}
                          />
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <span className="tabular text-xs text-p-muted">
                {tr(`Showing ${users.data.items.length} of ${users.data.total} users`)}
              </span>
              <Pagination
                page={users.data.page}
                totalPages={users.data.totalPages}
                onChange={(p) => update({ page: String(p) })}
              />
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
        title={tr(
          pending
            ? pending.kind === 'delete'
              ? `Delete ${pending.user.fullName}?`
              : ACTION_TEXT[pending.action].title(pending.user.fullName)
            : '',
        )}
        body={tr(
          pending
            ? pending.kind === 'delete'
              ? `This action is permanent and cannot be undone.\n\n${pending.user.fullName} (${pending.user.email}) will be removed.`
              : ACTION_TEXT[pending.action].body
            : '',
        )}
        confirmText={tr(pending?.kind === 'delete' ? 'Delete' : 'Confirm')}
        danger={
          pending?.kind === 'delete' ||
          pending?.action === 'deactivate' ||
          pending?.action === 'disapprove'
        }
        loading={busy}
        onConfirm={run}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
