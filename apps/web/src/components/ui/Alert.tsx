import type { ReactNode } from 'react';

export type AlertKind = 'success' | 'error' | 'info' | 'warning' | 'blocked';

const styles: Record<AlertKind, string> = {
  success: 'bg-[#d1fae5] text-[#065f46] border-p-success',
  error: 'bg-[#fee2e2] text-[#991b1b] border-p-danger',
  info: 'bg-[#e0f2fe] text-[#075985] border-p-primary',
  warning: 'bg-[#fed7aa] text-[#92400e] border-p-warning',
  blocked: 'bg-[#fee2e2] text-[#7f1d1d] border-[#dc2626]',
};

const icons: Record<AlertKind, string> = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️', blocked: '🚫' };

export function Alert({ kind, title, children, className = '' }: { kind: AlertKind; title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div role={kind === 'error' || kind === 'blocked' ? 'alert' : 'status'} className={`animate-slide-down rounded-lg border-l-4 p-4 text-sm ${styles[kind]} ${className}`}>
      {title && <div className="mb-1 text-base font-bold">{title}</div>}
      <div className="whitespace-pre-line">
        {!title && <span className="mr-1">{icons[kind]}</span>}
        {children}
      </div>
    </div>
  );
}
