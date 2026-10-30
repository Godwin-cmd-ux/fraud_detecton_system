import { useLanguage, translate as tr } from '../../i18n';
import type { ReactNode } from 'react';
import { DisplayIcon } from './DisplayIcon';

export type StatTone = 'blue' | 'green' | 'red' | 'amber' | 'purple' | 'gray';

const accents: Record<StatTone, string> = {
  blue: 'text-p-primary bg-p-primary/7',
  green: 'text-p-success bg-p-success/7',
  red: 'text-p-danger bg-p-danger/7',
  amber: 'text-p-warning bg-p-warning/7',
  purple: 'text-p-primary bg-p-primary/7',
  gray: 'text-p-muted bg-p-bg',
};

export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = 'blue',
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  icon?: string;
  tone?: StatTone;
}) {
  useLanguage();
  return (
    <div className="stat-card rounded-card border border-p-border bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-p-muted">
            {tr(typeof label === 'string' ? label.replace(/^[^\p{L}\p{N}]+/u, '') : label)}
          </div>
          <div className="mt-4 break-words text-[1.75rem] leading-tight font-semibold tracking-tight text-p-dark tabular-nums">
            {tr(value)}
          </div>
          {sub && <div className="mt-3 text-xs leading-relaxed text-p-muted">{tr(sub)}</div>}
        </div>
        {icon && (
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accents[tone]}`}
          >
            <DisplayIcon value={icon} size={18} />
          </div>
        )}
      </div>
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  useLanguage();
  return (
    <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr))]">
      {children}
    </div>
  );
}
