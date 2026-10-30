import { useLanguage, translate as tr } from '../../../i18n';
import { Link } from 'react-router';
import type { AdminUserRow } from '@fraud/shared';
import { Avatar } from '../../../components/ui/Avatar';
import { Badge } from '../../../components/ui/Badge';
import type { BadgeTone } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { formatDate, formatTsh } from '../../../lib/format';
import type { UserAction } from '../../../api/admin';

/** Active is good, pending needs review, inactive is simply switched off (red stays reserved for fraud). */
export function statusLabel(u: Pick<AdminUserRow, 'status'>): {
  text: string;
  sub: string;
  tone: BadgeTone;
} {
  switch (u.status) {
    case 'inactive':
      return { text: 'Inactive', sub: 'Deactivated', tone: 'gray' };
    case 'pending':
      return { text: 'Pending', sub: 'Awaiting Approval', tone: 'amber' };
    default:
      return { text: 'Active', sub: 'Fully Active', tone: 'green' };
  }
}

/** The action buttons shown for a user; only the transitions that apply to its current state. */
export function UserActionButtons({
  user,
  onAction,
  onDelete,
  size = 'sm',
}: {
  user: AdminUserRow;
  onAction: (action: UserAction) => void;
  onDelete: () => void;
  size?: 'sm' | 'md';
}) {
  useLanguage();
  return (
    <div className="flex flex-wrap gap-1.5">
      {!user.isApproved && user.isActive && (
        <Button size={size} variant="success" onClick={() => onAction('approve')}>
          {tr('Approve')}
        </Button>
      )}
      {user.isApproved && user.isActive && (
        <Button size={size} variant="warning" onClick={() => onAction('disapprove')}>
          {tr('Disapprove')}
        </Button>
      )}
      {user.isActive ? (
        <Button size={size} variant="secondary" onClick={() => onAction('deactivate')}>
          {tr('Deactivate')}
        </Button>
      ) : (
        <Button size={size} variant="success" onClick={() => onAction('activate')}>
          {tr('Activate')}
        </Button>
      )}
      <Button size={size} variant="danger" onClick={onDelete}>
        {tr('Delete')}
      </Button>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  useLanguage();
  return (
    <div className="rounded-xl border border-p-border bg-[#fafbf8] px-3.5 py-3">
      <div className="text-[11px] font-medium tracking-[0.08em] text-p-muted uppercase">
        {tr(label)}
      </div>
      <div className="mt-1 text-sm font-medium break-words text-p-dark">{children}</div>
    </div>
  );
}

export function UserViewModal({
  user,
  onClose,
  onAction,
  onDelete,
}: {
  user: AdminUserRow | null;
  onClose: () => void;
  onAction: (action: UserAction) => void;
  onDelete: () => void;
}) {
  useLanguage();
  const status = user ? statusLabel(user) : null;
  return (
    <Modal
      open={user !== null}
      onClose={onClose}
      title={tr('User Details')}
      size="lg"
      footer={
        user && (
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <UserActionButtons user={user} onAction={onAction} onDelete={onDelete} />
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onClose}>
                {tr('Close')}
              </Button>
              <Link to={`/admin/users/${user.id}/balance`}>
                <Button>{tr('Add Balance')}</Button>
              </Link>
            </div>
          </div>
        )
      }
    >
      {user && status && (
        <div>
          <div className="mb-5 flex items-center gap-4 rounded-2xl bg-gradient-to-br from-[#eef4ef] to-[#f7f8f4] p-4">
            <Avatar name={user.fullName} size={52} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-base font-semibold text-p-dark">{user.fullName}</div>
              <div className="truncate text-[13px] text-p-muted">{user.email}</div>
            </div>
            <Badge tone={status.tone} dot>
              {tr(status.text)}
            </Badge>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Detail label={tr('Current Balance')}>
              <span className="tabular">{formatTsh(user.balance)}</span>
            </Detail>
            <Detail label={tr('Phone')}>{user.phone}</Detail>
            <Detail label={tr('Card')}>
              <span className="font-mono">****{user.cardLast4}</span>
            </Detail>
            <Detail label={tr('Status')}>{tr(status.sub)}</Detail>
            <div className="sm:col-span-2">
              <Detail label={tr('Account Created')}>{formatDate(user.createdAt, 'long')}</Detail>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
