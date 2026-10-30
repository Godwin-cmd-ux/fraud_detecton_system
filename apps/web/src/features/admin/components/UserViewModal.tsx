import { useLanguage, translate as tr } from '../../../i18n';
import { Link } from 'react-router';
import type { AdminUserRow } from '@fraud/shared';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { formatDate, formatTsh } from '../../../lib/format';
import type { UserAction } from '../../../api/admin';

export function statusLabel(u: Pick<AdminUserRow, 'status'>): {
  text: string;
  sub: string;
  color: string;
} {
  switch (u.status) {
    case 'inactive':
      return { text: 'Inactive', sub: 'Deactivated', color: '#b4383d' };
    case 'pending':
      return { text: 'Pending', sub: 'Awaiting Approval', color: '#95600f' };
    default:
      return { text: 'Active', sub: 'Fully Active', color: '#1d7550' };
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  useLanguage();
  return (
    <div className="flex items-start justify-between gap-4 border-b border-p-border py-2 text-sm last:border-b-0">
      <span className="text-p-muted">{tr(label)}</span>
      <span className="text-right font-medium text-p-dark">{children}</span>
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
      footer={
        user && (
          <>
            <UserActionButtons user={user} onAction={onAction} onDelete={onDelete} size="md" />
            <Link to={`/admin/users/${user.id}/balance`}>
              <Button>{tr('Add Balance')}</Button>
            </Link>
            <Button variant="secondary" onClick={onClose}>
              {tr('Close')}
            </Button>
          </>
        )
      }
    >
      {user && status && (
        <div>
          <Row label={tr('Full Name')}>{user.fullName}</Row>
          <Row label={tr('Email')}>{user.email}</Row>
          <Row label={tr('Phone')}>{user.phone}</Row>
          <Row label={tr('Current Balance')}>{formatTsh(user.balance)}</Row>
          <Row label={tr('Card')}>****{user.cardLast4}</Row>
          <Row label={tr('Status')}>
            <span style={{ color: status.color }}>{tr(status.text)}</span>
          </Row>
          <Row label={tr('Account Created')}>{formatDate(user.createdAt, 'long')}</Row>
        </div>
      )}
    </Modal>
  );
}
