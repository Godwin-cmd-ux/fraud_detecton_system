import { useLanguage, translate as tr } from '../../i18n';
import type { ReactNode } from 'react';
import { CircleCheck, CircleX, Info, Ban, TriangleAlert } from 'lucide-react';
import { plainText } from '../../lib/text';

export type AlertKind = 'success' | 'error' | 'info' | 'warning' | 'blocked';

const styles: Record<AlertKind, string> = {
  success: 'bg-ok-soft text-ok border-ok/20',
  error: 'bg-risk-soft text-risk border-risk/20',
  info: 'bg-info-soft text-info border-info/20',
  warning: 'bg-warn-soft text-warn border-warn/20',
  blocked: 'bg-risk-soft text-risk border-risk/30',
};

const icons = {
  success: CircleCheck,
  error: CircleX,
  info: Info,
  warning: TriangleAlert,
  blocked: Ban,
} as const;

export function Alert({
  kind,
  title,
  children,
  className = '',
}: {
  kind: AlertKind;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  useLanguage();
  const Icon = icons[kind];
  return (
    <div
      role={kind === 'error' || kind === 'blocked' ? 'alert' : 'status'}
      className={`animate-slide-down flex gap-3 rounded-xl border p-4 text-sm leading-relaxed ${styles[kind]} ${className}`}
    >
      <Icon size={18} strokeWidth={2} className="mt-px shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <div className="mb-1 font-semibold">{tr(plainText(title))}</div>}
        <div className="whitespace-pre-line text-p-text">{tr(plainText(children))}</div>
      </div>
    </div>
  );
}
