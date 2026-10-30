import { useLanguage, translate as tr } from '../../i18n';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`w-full ${width} animate-slide-down rounded-xl bg-white p-6 shadow-2xl`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {title && <h2 className="mb-4 text-lg font-bold text-p-dark">{tr(title)}</h2>}
        <div className="text-sm text-p-text">{children}</div>
        {footer && <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
