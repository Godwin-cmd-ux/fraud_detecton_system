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
    <header className="page-header mb-8 flex flex-wrap items-center justify-between gap-5">
      <div className="min-w-0">
        <h1 className="text-3xl font-semibold tracking-tight text-p-dark">
          {tr(typeof title === 'string' ? title.replace(/^[^\p{L}\p{N}]+/u, '') : title)}
        </h1>
        {subtitle && <p className="mt-2 text-sm leading-relaxed text-p-muted">{tr(subtitle)}</p>}
      </div>
      <div className="flex items-center gap-4">
        {actions}
        <div className="text-right">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-p-border bg-white font-semibold text-p-primary">
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
