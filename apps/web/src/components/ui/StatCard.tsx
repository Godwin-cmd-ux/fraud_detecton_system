import type { ReactNode } from 'react';

export type StatTone = 'blue' | 'green' | 'red' | 'amber' | 'purple' | 'gray';

const accents: Record<StatTone, string> = {
  blue: 'border-l-p-primary',
  green: 'border-l-p-success',
  red: 'border-l-p-danger',
  amber: 'border-l-p-warning',
  purple: 'border-l-[#8b5cf6]',
  gray: 'border-l-p-muted',
};

export function StatCard({ label, value, sub, icon, tone = 'blue' }: { label: ReactNode; value: ReactNode; sub?: ReactNode; icon?: string; tone?: StatTone }) {
  return (
    <div className={`rounded-card border border-p-border border-l-4 bg-white p-5 shadow-sm ${accents[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold tracking-wide text-p-muted uppercase">{label}</div>
          <div className="mt-1 truncate text-2xl font-bold text-p-dark">{value}</div>
          {sub && <div className="mt-1 text-xs text-p-muted">{sub}</div>}
        </div>
        {icon && <div className="text-2xl">{icon}</div>}
      </div>
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">{children}</div>;
}
