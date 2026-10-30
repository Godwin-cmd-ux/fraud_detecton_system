import { useLanguage, translate as tr } from '../../i18n';
import type { ReactNode } from 'react';
import { DisplayIcon } from './DisplayIcon';
import { plainText } from '../../lib/text';

export type StatTone = 'blue' | 'green' | 'red' | 'amber' | 'purple' | 'gray';

/** Icon chip colours and the hover accent line, keyed by meaning rather than hue. */
const accents: Record<StatTone, { chip: string; line: string }> = {
  blue: { chip: 'text-p-primary bg-p-primary/8', line: 'var(--color-p-primary)' },
  green: { chip: 'text-ok bg-ok-soft', line: 'var(--color-ok)' },
  red: { chip: 'text-risk bg-risk-soft', line: 'var(--color-risk)' },
  amber: { chip: 'text-warn bg-warn-soft', line: 'var(--color-warn)' },
  purple: { chip: 'text-info bg-info-soft', line: 'var(--color-info)' },
  gray: { chip: 'text-p-muted bg-[#eef0eb]', line: 'var(--color-p-muted)' },
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
  const long = typeof value === 'string' && value.length > 12;
  return (
    <div
      className="stat-card flex flex-col rounded-card border border-p-border bg-white p-5"
      style={{ '--stat-accent': accents[tone].line } as React.CSSProperties}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-[13px] font-medium text-p-muted">{tr(plainText(label))}</div>
        {icon && (
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${accents[tone].chip}`}
          >
            <DisplayIcon value={icon} size={16} />
          </div>
        )}
      </div>
      <div
        className={`tabular mt-3 font-semibold tracking-tight text-p-dark ${long ? 'text-xl leading-snug sm:text-[1.35rem]' : 'text-[1.75rem] leading-tight'}`}
      >
        {tr(plainText(value))}
      </div>
      {sub && <div className="mt-auto pt-3 text-xs leading-relaxed text-p-muted">{tr(sub)}</div>}
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  useLanguage();
  return (
    <div className="stagger grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,150px),1fr))] sm:gap-4 sm:[grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
      {children}
    </div>
  );
}
