import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { Textarea } from '../../../components/ui/Textarea';

export interface ReasonModalProps {
  open: boolean;
  title: ReactNode;
  body?: ReactNode;
  reasonRequired?: boolean;
  confirmText: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

/** Approve / reject dialog with an optional or required reason field. */
export function ReasonModal({ open, title, body, reasonRequired, confirmText, danger, loading, onConfirm, onCancel }: ReasonModalProps) {
  const [reason, setReason] = useState('');
  const disabled = reasonRequired && reason.trim().length === 0;
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={danger ? 'danger' : 'success'}
            onClick={() => {
              onConfirm(reason.trim());
              setReason('');
            }}
            disabled={disabled}
            loading={loading}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      {body && <div className="mb-3">{body}</div>}
      <Textarea
        label={reasonRequired ? 'Reason (required)' : 'Reason (optional)'}
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Add a note for the audit log"
      />
    </Modal>
  );
}
