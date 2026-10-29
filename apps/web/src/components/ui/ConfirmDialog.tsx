import { useLanguage, translate as tr } from '../../i18n';
import type { ReactNode } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';

export interface ConfirmDialogProps {
  open: boolean;
  title: ReactNode;
  body?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** In-app replacement for window.confirm(); the message may contain newlines. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger,
  loading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useLanguage();
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={tr(title)}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {tr(cancelText)}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {tr(confirmText)}
          </Button>
        </>
      }
    >
      {typeof body === 'string' ? <p className="whitespace-pre-line">{tr(body)}</p> : body}
    </Modal>
  );
}
