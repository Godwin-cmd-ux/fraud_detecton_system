import { useLanguage, translate as tr } from '../../i18n';
import type { ReactNode } from 'react';
import { useClock } from '../../lib/useClock';

export function TopHeader({
  title,
  subtitle,
  name,
  hint,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  name: string;
  hint?: ReactNode;
  actions?: ReactNode;
}) {
  useLanguage();
  const clock = useClock();
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4 rounded-card border border-p-border bg-white px-5 py-4 shadow-sm">
      <div>
        <h1 className="text-2xl font-bold text-p-dark">{tr(title)}</h1>
        {subtitle && <p className="text-sm text-p-muted">{tr(subtitle)}</p>}
      </div>
      <div className="flex items-center gap-4">
        {actions}
        <div className="text-right">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-p-primary font-bold text-white">
              {name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-semibold text-p-dark">{name}</div>
              {hint && <div className="text-xs text-p-muted">{tr(hint)}</div>}
            </div>
          </div>
          <div className="mt-1 text-xs text-p-muted" data-testid="clock">
            {clock}
          </div>
        </div>
      </div>
    </header>
  );
}
