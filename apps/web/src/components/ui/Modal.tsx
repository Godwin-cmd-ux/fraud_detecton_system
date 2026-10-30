import { useLanguage, translate as tr } from '../../i18n';
import { useEffect, useId } from 'react';
import type { ReactNode } from 'react';
import { plainText } from '../../lib/text';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

/** Accessible dialog: Escape and backdrop click close it. */
export function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  useLanguage();
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const width = size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-2xl' : 'max-w-md';
  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-end justify-center bg-[#0e2a2c]/45 p-3 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={`modal-panel max-h-[90dvh] w-full overflow-y-auto ${width} rounded-2xl bg-white p-6 shadow-[0_30px_80px_-20px_#0e2a2c80]`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {title && (
          <h2 id={titleId} className="mb-4 text-lg font-semibold tracking-tight text-p-dark">
            {tr(plainText(title))}
          </h2>
        )}
        <div className="text-sm text-p-text">{children}</div>
        {footer && <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
