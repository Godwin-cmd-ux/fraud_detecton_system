import { useLanguage, translate as tr } from '../../../i18n';
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
export function ReasonModal({
  open,
  title,
  body,
  reasonRequired,
  confirmText,
  danger,
  loading,
  onConfirm,
  onCancel,
}: ReasonModalProps) {
  useLanguage();
  const [reason, setReason] = useState('');
  const disabled = reasonRequired && reason.trim().length === 0;
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={tr(title)}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {tr('Cancel')}
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
            {tr(confirmText)}
          </Button>
        </>
      }
    >
      {body && <div className="mb-3">{tr(body)}</div>}
      <Textarea
        label={tr(reasonRequired ? 'Reason (required)' : 'Reason (optional)')}
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={tr('Add a note for the audit log')}
      />
    </Modal>
  );
}
